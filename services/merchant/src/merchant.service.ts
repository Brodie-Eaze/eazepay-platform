import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { BadRequest, Conflict, Forbidden, NotFound, sha256Hex } from '@eazepay/shared-utils';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import {
  PiiVaultService,
  type PiiV1,
} from '@eazepay/service-user';
import { PRISMA } from './internal/tokens.js';
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
  ) {}

  async create(userId: UserId, dto: CreateMerchantDto): Promise<{ id: MerchantId; slug: string }> {
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

    // Reuse the same envelope encryption pattern as ConsumerProfile.
    // The PiiVaultService AAD-binds to the user id; here we pass the
    // merchant id as the "owner" so each merchant's BO blobs cannot be
    // swapped between rows.
    const sealed = await this.vault.seal(merchantId as unknown as UserId, dto.pii as unknown as PiiV1);

    return this.prisma.$transaction(async (tx) => {
      const bo = await tx.beneficialOwner.create({
        data: {
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

    // Open each BO blob for the KYB call. We never persist plaintext;
    // the KYB adapter receives PII transiently and never stores it.
    const owners = await Promise.all(
      merchant.beneficialOwners.map(async (bo) => ({
        pii: (await this.vault.open(merchantId as unknown as UserId, {
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
