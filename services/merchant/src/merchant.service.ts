import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequest, Conflict, Forbidden, NotFound, sha256Hex } from '@eazepay/shared-utils';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import {
  PiiVaultService,
  type PiiV1,
} from '@eazepay/service-user';
import { MERCHANT_REGISTRATION_REQUIRES_ADMIN, PRISMA } from './internal/tokens.js';
import { KYB_PROVIDER, type KybProvider } from './ports/kyb-provider.port.js';
import type { BoPiiV1 } from './bo-pii.types.js';
import type { CreateMerchantDto } from './dto/create-merchant.dto.js';
import type { AddBeneficialOwnerDto } from './dto/add-beneficial-owner.dto.js';
import type { CreateApplicationLinkDto } from './dto/create-application-link.dto.js';

const PROHIBITED_NAICS_PREFIXES = ['7132', '7139', '7224', '7222']; // gambling, adult, etc — placeholder
const TOKEN_BYTES = 32;

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(KYB_PROVIDER) private readonly kyb: KybProvider,
    @Inject(MERCHANT_REGISTRATION_REQUIRES_ADMIN)
    private readonly requiresAdmin: boolean,
  ) {}

  async create(userId: UserId, dto: CreateMerchantDto): Promise<{ id: MerchantId; slug: string }> {
    // SEC-017 — outside development, refuse merchant creation from
    // non-admin users. Threat: pre-fix, any authenticated user could
    // POST /v1/merchants and become the owner MerchantUser, then add
    // their own arbitrary beneficial-owner records and submit to KYB.
    // That feeds two attacks: (1) the orchestration layer treats the
    // merchant row as a real business and queues real KYB/credit
    // checks against synthetic data, and (2) once `kybStatus=approved`
    // (mock or real), the attacker can mint hosted application links
    // and route consumer applications through a merchant they
    // fabricated. Dev environments keep the gate off so seed scripts
    // and local demo flows still work; staging/prod require admin.
    if (this.requiresAdmin) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true, status: true },
      });
      if (!u || u.status !== 'active' || !u.isAdmin) {
        throw Forbidden({
          code: 'merchant_creation_requires_admin',
          detail:
            'Merchant onboarding is admin-gated in this environment. Contact compliance to provision the row, then your account will be linked as owner.',
        });
      }
    }

    if (dto.naicsCode && PROHIBITED_NAICS_PREFIXES.some((p) => dto.naicsCode!.startsWith(p))) {
      throw BadRequest({
        code: 'industry_prohibited',
        detail: `NAICS prefix not supported at MVP`,
      });
    }

    const slug = await this.generateSlug(dto.legalName);

    return this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          slug,
          legalName: dto.legalName,
          dba: dto.dba ?? null,
          ein: dto.ein ?? null,
          formationState: dto.formationState ?? null,
          naicsCode: dto.naicsCode ?? null,
          mcc: dto.mcc ?? null,
          industry: dto.industry ?? null,
          website: dto.website ?? null,
        },
        select: { id: true, slug: true },
      });

      // Owner gets the owner MerchantUser row.
      await tx.merchantUser.create({
        data: {
          merchantId: merchant.id,
          userId,
          role: 'owner',
          permissions: ['*'],
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'merchant.created',
          targetType: 'Merchant',
          targetId: merchant.id,
          after: { slug: merchant.slug, legalName: dto.legalName },
        },
      });

      return { id: merchant.id as MerchantId, slug: merchant.slug };
    });
  }

  async getOne(userId: UserId, merchantId: MerchantId): Promise<{
    id: MerchantId;
    slug: string;
    legalName: string;
    dba: string | null;
    status: string;
    kybStatus: string;
    mdrBps: number;
    createdAt: string;
  }> {
    await this.assertMember(userId, merchantId);
    const m = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
    });
    return {
      id: m.id as MerchantId,
      slug: m.slug,
      legalName: m.legalName,
      dba: m.dba,
      status: m.status,
      kybStatus: m.kybStatus,
      mdrBps: m.mdrBps,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async addBeneficialOwner(
    userId: UserId,
    merchantId: MerchantId,
    dto: AddBeneficialOwnerDto,
  ): Promise<{ id: string }> {
    await this.assertCanManage(userId, merchantId);
    if (dto.ownershipPct < 0 || dto.ownershipPct > 100) {
      throw BadRequest({ code: 'ownership_pct_invalid' });
    }

    // SEC-019 — pre-generate the BO row id so the sealed-blob AAD can
    // bind to THIS specific BO before the row exists. Previously the
    // AAD was `pii:<merchantId>:v1`, identical for every BO of one
    // merchant — meaning any ciphertext from BO A could be swapped
    // onto BO B's row and the GCM auth tag would still verify (wrong-
    // person PII presented to KYB, leaked under unmask). The fix is
    // to bind AAD to `pii:bo:<beneficialOwnerId>:v2`, which only
    // verifies when the row id matches. We compute the id, seal with
    // it, then insert the row with that exact id inside the
    // transaction. Sealing OUTSIDE the transaction keeps the KMS
    // round-trip from holding a DB connection.
    const beneficialOwnerId = randomUUID();
    const sealed = await this.vault.sealForBo(
      beneficialOwnerId,
      dto.pii as unknown as PiiV1,
    );

    return this.prisma.$transaction(async (tx) => {
      const bo = await tx.beneficialOwner.create({
        data: {
          id: beneficialOwnerId,
          merchantId,
          piiCiphertext: sealed.ciphertext,
          piiNonce: sealed.nonce,
          dataKeyCiphertext: sealed.dataKeyCiphertext,
          kekId: sealed.kekId,
          piiSchemaVersion: sealed.schemaVersion,
          ownershipPct: dto.ownershipPct,
          isControlling: dto.isControlling,
        },
        select: { id: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'merchant.beneficial_owner.added',
          targetType: 'BeneficialOwner',
          targetId: bo.id,
          after: { merchantId, ownershipPct: dto.ownershipPct, isControlling: dto.isControlling },
        },
      });
      return bo;
    });
  }

  async startKyb(userId: UserId, merchantId: MerchantId): Promise<{
    outcome: 'pending' | 'approved' | 'manual_review' | 'rejected';
    providerRef: string;
  }> {
    await this.assertCanManage(userId, merchantId);

    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      include: { beneficialOwners: true },
    });
    if (merchant.kybStatus === 'approved') {
      return { outcome: 'approved', providerRef: merchant.kybProviderRef ?? '' };
    }
    if (merchant.beneficialOwners.length === 0) {
      throw BadRequest({
        code: 'beneficial_owner_required',
        detail: 'add at least one beneficial owner before initiating KYB',
      });
    }

    // SEC-019 — open each BO blob via the BO-id-bound AAD. The vault
    // picks v1 vs v2 AAD by inspecting the persisted schemaVersion,
    // so legacy v1 rows (merchant-bound AAD) keep decrypting while
    // new v2 rows (BO-id-bound) cannot be swapped between BOs. We
    // never persist plaintext; the KYB adapter receives PII
    // transiently and never stores it.
    const owners = await Promise.all(
      merchant.beneficialOwners.map(async (bo) => ({
        pii: (await this.vault.openForBo(bo.id, merchantId, {
          ciphertext: bo.piiCiphertext,
          nonce: bo.piiNonce,
          dataKeyCiphertext: bo.dataKeyCiphertext,
          kekId: bo.kekId,
          schemaVersion: bo.piiSchemaVersion,
        })) as unknown as BoPiiV1,
        ownershipPct: bo.ownershipPct,
        isControlling: bo.isControlling,
      })),
    );

    const initiate = await this.kyb.initiate({
      merchantId,
      legalName: merchant.legalName,
      ein: merchant.ein ?? undefined,
      formationState: merchant.formationState ?? undefined,
      naicsCode: merchant.naicsCode ?? undefined,
      beneficialOwners: owners,
    });
    const status = await this.kyb.status(initiate.providerRef);

    await this.prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          kybStatus:
            status.outcome === 'approved'
              ? 'approved'
              : status.outcome === 'manual_review'
                ? 'manual_review'
                : status.outcome === 'rejected'
                  ? 'rejected'
                  : 'in_progress',
          status:
            status.outcome === 'approved'
              ? 'active'
              : status.outcome === 'manual_review'
                ? 'kyb_manual_review'
                : status.outcome === 'rejected'
                  ? 'suspended'
                  : 'kyb_in_progress',
          kybProviderRef: initiate.providerRef,
          kybLastCheckedAt: new Date(),
          kybCompletedAt: status.outcome === 'approved' ? new Date() : null,
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'merchant.kyb.initiated',
          targetType: 'Merchant',
          targetId: merchantId,
          after: {
            providerRef: initiate.providerRef,
            outcome: status.outcome,
            reasonCodes: status.reasonCodes,
            ofac: status.ofac,
            ein: status.ein,
          },
        },
      });
    });

    return { outcome: status.outcome, providerRef: initiate.providerRef };
  }

  async createApplicationLink(
    userId: UserId,
    merchantId: MerchantId,
    dto: CreateApplicationLinkDto,
  ): Promise<{ id: string; url: string; token: string; expiresAt: string }> {
    await this.assertCanManage(userId, merchantId);
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { slug: true, status: true },
    });
    if (merchant.status !== 'active') {
      throw Conflict({
        code: 'merchant_not_active',
        detail: `merchant status=${merchant.status} — KYB approval required before generating links`,
      });
    }

    const tokenRaw = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = sha256Hex(tokenRaw);
    const expiresAt = new Date(Date.now() + dto.expiresInMinutes * 60 * 1000);

    const link = await this.prisma.applicationLink.create({
      data: {
        merchantId,
        tokenHash,
        category: dto.category ?? null,
        amountHintCents: dto.amountHintCents ?? null,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        expiresAt,
        createdByUserId: userId,
      },
      select: { id: true },
    });

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'merchant.application_link.created',
        targetType: 'ApplicationLink',
        targetId: link.id,
        after: {
          merchantId,
          category: dto.category ?? null,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return {
      id: link.id,
      // Hosted apply page lives in apps/consumer-web; URL shape locked here.
      url: `https://eazepay.com/apply/${merchant.slug}/${tokenRaw}`,
      token: tokenRaw,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Public endpoint use case: fetch the merchant + link context so the
   * apply page can render branding, pre-fills, and validate the token
   * before prompting the consumer to register/login.
   * Throws on missing/expired/used/revoked link.
   */
  async getLinkContext(slug: string, tokenRaw: string): Promise<{
    merchantId: MerchantId;
    merchantSlug: string;
    merchantLegalName: string;
    merchantDba: string | null;
    linkId: string;
    category: string | null;
    amountHintCents: bigint | null;
    customerEmail: string | null;
    customerPhone: string | null;
    expiresAt: string;
  }> {
    const tokenHash = sha256Hex(tokenRaw);
    const link = await this.prisma.applicationLink.findUnique({
      where: { tokenHash },
      include: { merchant: true },
    });
    if (!link) throw NotFound({ code: 'link_not_found' });
    if (link.merchant.slug !== slug) throw NotFound({ code: 'link_not_found' });
    if (link.revokedAt) throw Conflict({ code: 'link_revoked' });
    if (link.usedAt) throw Conflict({ code: 'link_already_used' });
    if (link.expiresAt.getTime() < Date.now()) {
      throw Conflict({ code: 'link_expired' });
    }
    return {
      merchantId: link.merchantId as MerchantId,
      merchantSlug: link.merchant.slug,
      merchantLegalName: link.merchant.legalName,
      merchantDba: link.merchant.dba,
      linkId: link.id,
      category: link.category,
      amountHintCents: link.amountHintCents,
      customerEmail: link.customerEmail,
      customerPhone: link.customerPhone,
      expiresAt: link.expiresAt.toISOString(),
    };
  }

  /**
   * Atomically mark a link consumed against a freshly-created Application.
   * Returns true on success; throws if the link is no longer valid (race
   * with another consumer using the same token simultaneously).
   */
  async markLinkUsed(linkId: string, applicationId: string): Promise<void> {
    const result = await this.prisma.applicationLink.updateMany({
      where: { id: linkId, usedAt: null, revokedAt: null },
      data: { usedAt: new Date(), usedByApplicationId: applicationId },
    });
    if (result.count === 0) {
      throw Conflict({ code: 'link_already_consumed' });
    }
  }

  /**
   * List applications referred via this merchant (any channel where
   * application.merchantId == merchantId). Member-scoped read.
   */
  async listApplications(
    userId: UserId,
    merchantId: MerchantId,
    opts: { cursor?: string; limit: number },
  ): Promise<{
    items: Array<{
      id: string;
      status: string;
      category: string;
      requestedAmountCents: bigint;
      termMonths: number;
      submittedAt: string | null;
      decisionAt: string | null;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    await this.assertMember(userId, merchantId);
    const apps = await this.prisma.application.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });
    const hasMore = apps.length > opts.limit;
    const sliced = hasMore ? apps.slice(0, opts.limit) : apps;
    return {
      items: sliced.map((a) => ({
        id: a.id,
        status: a.status,
        category: a.category,
        requestedAmountCents: a.requestedAmountCents,
        termMonths: a.termMonths,
        submittedAt: a.submittedAt?.toISOString() ?? null,
        decisionAt: a.decisionAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  // -------------- helpers --------------

  private async assertMember(userId: UserId, merchantId: MerchantId): Promise<void> {
    const link = await this.prisma.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
    });
    if (!link) throw NotFound({ code: 'merchant_not_found' });
  }

  private async assertCanManage(userId: UserId, merchantId: MerchantId): Promise<void> {
    const link = await this.prisma.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
    });
    if (!link) throw NotFound({ code: 'merchant_not_found' });
    if (link.role === 'read_only' || link.role === 'staff') {
      throw Forbidden({ code: 'insufficient_role', detail: `role=${link.role}` });
    }
  }

  private async generateSlug(legalName: string): Promise<string> {
    const base = legalName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'merchant';
    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const existing = await this.prisma.merchant.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }
}
