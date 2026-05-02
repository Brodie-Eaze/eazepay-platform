import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { sha256Hex } from '@eazepay/shared-utils';
import { PRISMA } from './internal/tokens.js';
import { POST_SUBMIT_HOOK, type PostSubmitHook } from './ports/post-submit.port.js';
import {
  ESIGN_PROVIDER,
  type ESignProvider,
} from './ports/esign-provider.port.js';
import { applyTransition } from './state-machine.js';
import type {
  ApplicationEvent,
  ApplicationSnapshot,
  ApplicationStatus,
} from './application.types.js';
import type { CreateApplicationDto } from './dto/create-application.dto.js';
import type { UpdateApplicationDto } from './dto/update-application.dto.js';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(POST_SUBMIT_HOOK) private readonly postSubmit: PostSubmitHook,
    @Inject(ESIGN_PROVIDER) private readonly esign: ESignProvider,
  ) {}

  async create(userId: UserId, dto: CreateApplicationDto): Promise<ApplicationSnapshot> {
    if (dto.channel !== 'consumer_direct' && !dto.merchantId) {
      throw BadRequest({
        code: 'merchant_required',
        detail: `channel=${dto.channel} requires merchantId`,
      });
    }
    if (dto.channel === 'consumer_direct' && dto.merchantId) {
      throw BadRequest({
        code: 'merchant_not_allowed',
        detail: 'consumer_direct applications must not carry merchantId',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          userId,
          merchantId: dto.merchantId ?? null,
          channel: dto.channel,
          category: dto.category,
          requestedAmountCents: dto.requestedAmountCents,
          termMonths: dto.termMonths,
          purposeDetail: dto.purposeDetail ?? null,
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'application.created',
          targetType: 'Application',
          targetId: app.id,
          after: this.auditPayload(app),
        },
      });
      return this.toSnapshot(app);
    });
  }

  async update(
    userId: UserId,
    applicationId: ApplicationId,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, userId },
      });
      if (!app) throw NotFound({ code: 'application_not_found' });
      if (app.status !== 'draft') {
        throw Conflict({
          code: 'application_not_draft',
          detail: 'application can only be edited in draft',
        });
      }
      const before = this.auditPayload(app);
      const updated = await tx.application.update({
        where: { id: app.id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.requestedAmountCents !== undefined && {
            requestedAmountCents: dto.requestedAmountCents,
          }),
          ...(dto.termMonths !== undefined && { termMonths: dto.termMonths }),
          ...(dto.purposeDetail !== undefined && { purposeDetail: dto.purposeDetail }),
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'application.updated',
          targetType: 'Application',
          targetId: app.id,
          before,
          after: this.auditPayload(updated),
        },
      });
      return this.toSnapshot(updated);
    });
  }

  async getOne(userId: UserId, applicationId: ApplicationId): Promise<ApplicationSnapshot> {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });
    return this.toSnapshot(app);
  }

  async listOffers(
    userId: UserId,
    applicationId: ApplicationId,
  ): Promise<
    Array<{
      id: string;
      lenderProductId: string;
      lenderOfRecord: string;
      amountCents: bigint;
      termMonths: number;
      aprBps: number;
      comparisonRateBps: number | null;
      feesCents: bigint;
      totalRepayableCents: bigint;
      rank: number;
      status: string;
      expiresAt: string;
    }>
  > {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });
    const offers = await this.prisma.offer.findMany({
      where: { applicationId },
      orderBy: { rank: 'asc' },
    });
    return offers.map((o) => ({
      id: o.id,
      lenderProductId: o.lenderProductId,
      lenderOfRecord: o.lenderOfRecord,
      amountCents: o.amountCents,
      termMonths: o.termMonths,
      aprBps: o.aprBps,
      comparisonRateBps: o.comparisonRateBps,
      feesCents: o.feesCents,
      totalRepayableCents: o.totalRepayableCents,
      rank: o.rank,
      status: o.status,
      expiresAt: o.expiresAt.toISOString(),
    }));
  }

  async list(userId: UserId, opts: { cursor?: string; limit: number }): Promise<{
    items: ApplicationSnapshot[];
    nextCursor: string | null;
  }> {
    const items = await this.prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });
    const hasMore = items.length > opts.limit;
    const sliced = hasMore ? items.slice(0, opts.limit) : items;
    return {
      items: sliced.map((a) => this.toSnapshot(a)),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  async submit(userId: UserId, applicationId: ApplicationId): Promise<ApplicationSnapshot> {
    const result = await this.transition(userId, applicationId, { type: 'SUBMIT' }, (tx, app) =>
      tx.application.update({
        where: { id: app.id },
        data: { status: 'submitted', submittedAt: new Date() },
      }),
    );

    // Fire the side-effect hook AFTER the transaction commits. We don't
    // await it: the consumer gets a fast response showing `submitted`
    // and polls (or receives a webhook) for the resulting offers. Errors
    // are logged but don't roll back the submission — orchestration is
    // designed to be re-driven idempotently from `submitted` state.
    void this.postSubmit
      .onSubmitted(result.id)
      .catch((err) => this.logger.error({ err, applicationId: result.id }, 'post-submit hook failed'));

    return result;
  }

  /**
   * Consumer accepts an offer. End-to-end:
   *  1. Validate offer ownership + presented status + not expired.
   *  2. Withdraw siblings (offers cannot be silently un-presented).
   *  3. Transition application offers_presented → accepted with the
   *     accepted offer flagged.
   *  4. Render the contract (placeholder — real Reg Z disclosures land
   *     in services/contract). Compute a stable SHA-256 hash of the
   *     rendered document for the audit anchor.
   *  5. Send envelope via ESignProvider. In dev, MockESign returns
   *     `signed` synchronously; in prod, the provider returns `sent`
   *     and the webhook handler completes the contracted transition
   *     later. Both paths land at `contracted` + a Loan row when the
   *     status is `signed`.
   */
  async acceptOffer(
    userId: UserId,
    applicationId: ApplicationId,
    offerId: string,
  ): Promise<ApplicationSnapshot> {
    // Step 1-3 in one transaction.
    const accepted = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, userId },
      });
      if (!app) throw NotFound({ code: 'application_not_found' });

      const offer = await tx.offer.findFirst({
        where: { id: offerId, applicationId: app.id },
      });
      if (!offer) throw NotFound({ code: 'offer_not_found' });
      if (offer.status !== 'presented') {
        throw Conflict({ code: 'offer_not_acceptable', detail: `offer status=${offer.status}` });
      }
      if (offer.expiresAt.getTime() < Date.now()) {
        throw Conflict({ code: 'offer_expired' });
      }

      const next = applyTransition(app.status, { type: 'ACCEPT_OFFER', offerId });
      if (!next) {
        throw Conflict({
          code: 'invalid_transition',
          detail: `cannot ACCEPT_OFFER from ${app.status}`,
        });
      }

      // Withdraw siblings.
      await tx.offer.updateMany({
        where: { applicationId: app.id, id: { not: offerId }, status: 'presented' },
        data: { status: 'withdrawn' },
      });
      await tx.offer.update({
        where: { id: offerId },
        data: { status: 'accepted' },
      });
      await tx.application.update({
        where: { id: app.id },
        data: { status: 'accepted' },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'application.offer_accepted',
          targetType: 'Offer',
          targetId: offerId,
          before: { status: app.status },
          after: { status: 'accepted', offerId },
        },
      });
      return { app, offer };
    });

    // Step 4 — render + hash contract.
    const docPayload = JSON.stringify({
      applicationId: accepted.app.id,
      offerId: accepted.offer.id,
      lenderOfRecord: accepted.offer.lenderOfRecord,
      principalCents: accepted.offer.amountCents.toString(),
      aprBps: accepted.offer.aprBps,
      termMonths: accepted.offer.termMonths,
      feesCents: accepted.offer.feesCents.toString(),
      totalRepayableCents: accepted.offer.totalRepayableCents.toString(),
    });
    const documentSha256 = sha256Hex(docPayload);

    // Step 5 — send envelope.
    const envelope = await this.esign.draftAndSend({
      applicationId: accepted.app.id,
      offerId: accepted.offer.id,
      userId,
      signerContact: userId, // placeholder; real flow looks up verified email/phone
      documentSha256,
      metadata: {
        lenderOfRecord: accepted.offer.lenderOfRecord,
      },
    });

    // Persist Contract.
    await this.prisma.contract.create({
      data: {
        applicationId: accepted.app.id,
        offerId: accepted.offer.id,
        signatureProvider: envelope.provider,
        envelopeId: envelope.envelopeId,
        documentSha256,
        status: envelope.status,
        signedAt: envelope.status === 'signed' ? new Date() : null,
      },
    });

    // If the provider auto-signed (mock dev path), complete to contracted
    // + create the Loan record in one transaction. Webhook-driven prod
    // path handles this in the inbound webhook handler.
    if (envelope.status === 'signed') {
      return this.completeContractSigned(userId, accepted.app.id);
    }

    // Otherwise return the application as-is (status=accepted) and let
    // the webhook drive the transition later.
    return this.toSnapshot(
      await this.prisma.application.findUniqueOrThrow({ where: { id: accepted.app.id } }),
    );
  }

  /**
   * Called from the e-sign webhook handler (or directly from acceptOffer
   * when the provider returns `signed` synchronously). Idempotent: safe
   * to call repeatedly for the same applicationId. User-scoped — passes
   * the userId in the where clause to defend against cross-user calls.
   */
  async completeContractSigned(
    userId: UserId,
    applicationId: ApplicationId,
  ): Promise<ApplicationSnapshot> {
    return this.completeContractSignedInternal({ applicationId, userId, actorType: 'user' });
  }

  /**
   * Webhook-driven completion. Resolves the Application via Contract by
   * envelopeId — provider has been signature-verified by the caller. The
   * actor is recorded as 'service' in the audit row, NOT a user.
   */
  async completeContractSignedByEnvelope(envelopeId: string): Promise<ApplicationSnapshot> {
    const contract = await this.prisma.contract.findFirst({
      where: { envelopeId },
      select: { applicationId: true, status: true },
    });
    if (!contract) throw NotFound({ code: 'contract_not_found' });
    if (contract.status !== 'signed') {
      // Mark contract signed first; webhook may have arrived ahead of
      // our local Contract.status update for prod (non-mock) flows.
      await this.prisma.contract.update({
        where: { envelopeId },
        data: { status: 'signed', signedAt: new Date() },
      });
    }
    return this.completeContractSignedInternal({
      applicationId: contract.applicationId as ApplicationId,
      userId: null,
      actorType: 'service',
    });
  }

  private async completeContractSignedInternal(args: {
    applicationId: ApplicationId;
    userId: UserId | null;
    actorType: 'user' | 'service';
  }): Promise<ApplicationSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const where = args.userId
        ? { id: args.applicationId, userId: args.userId }
        : { id: args.applicationId };
      const app = await tx.application.findFirst({
        where,
        include: {
          offers: { where: { status: 'accepted' }, take: 1 },
          contracts: { where: { status: 'signed' }, take: 1 },
        },
      });
      if (!app) throw NotFound({ code: 'application_not_found' });
      if (app.status === 'contracted' || app.status === 'funding' || app.status === 'active') {
        return this.toSnapshot(app);
      }
      if (app.status !== 'accepted') {
        throw Conflict({
          code: 'invalid_transition',
          detail: `cannot CONTRACT_SIGNED from ${app.status}`,
        });
      }
      const offer = app.offers[0];
      if (!offer) throw Conflict({ code: 'no_accepted_offer' });

      await tx.application.update({
        where: { id: app.id },
        data: { status: 'contracted' },
      });

      // Create the Loan. Lender-of-record is snapshotted now and
      // immutable thereafter — that's the audit anchor for who issued.
      await tx.loan.create({
        data: {
          applicationId: app.id,
          offerId: offer.id,
          userId: app.userId,
          lenderOfRecord: offer.lenderOfRecord,
          lenderProductId: offer.lenderProductId,
          principalCents: offer.amountCents,
          termMonths: offer.termMonths,
          aprBps: offer.aprBps,
          totalRepayableCents: offer.totalRepayableCents,
          status: 'funding_pending',
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: args.actorType,
          actorId: args.userId,
          action: 'application.contracted',
          targetType: 'Application',
          targetId: app.id,
          after: { offerId: offer.id, lenderOfRecord: offer.lenderOfRecord },
        },
      });

      const refreshed = await tx.application.findUniqueOrThrow({ where: { id: app.id } });
      return this.toSnapshot(refreshed);
    });
  }

  async cancel(userId: UserId, applicationId: ApplicationId): Promise<ApplicationSnapshot> {
    return this.transition(userId, applicationId, { type: 'CANCEL' }, (tx, app) =>
      tx.application.update({
        where: { id: app.id },
        data: { status: 'cancelled', decisionAt: new Date() },
      }),
    );
  }

  /**
   * Generic transition runner: validates the transition, persists the new
   * status (and any extra fields supplied by the caller), and writes an
   * audit row in the same Postgres transaction.
   */
  private async transition(
    userId: UserId,
    applicationId: ApplicationId,
    event: ApplicationEvent,
    persist: (
      tx: Prisma.TransactionClient,
      current: { id: string; status: ApplicationStatus },
    ) => Promise<{ id: string; status: ApplicationStatus }>,
  ): Promise<ApplicationSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, userId },
      });
      if (!app) throw NotFound({ code: 'application_not_found' });

      const next = applyTransition(app.status, event);
      if (!next) {
        throw Conflict({
          code: 'invalid_transition',
          detail: `cannot ${event.type} from ${app.status}`,
        });
      }

      await persist(tx, { id: app.id, status: app.status });

      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: `application.${event.type.toLowerCase()}`,
          targetType: 'Application',
          targetId: app.id,
          before: { status: app.status },
          after: { status: next, event },
        },
      });

      const refreshed = await tx.application.findUniqueOrThrow({
        where: { id: app.id },
      });
      return this.toSnapshot(refreshed);
    });
  }

  private toSnapshot(a: {
    id: string;
    userId: string;
    merchantId: string | null;
    channel: ApplicationSnapshot['channel'];
    category: ApplicationSnapshot['category'];
    requestedAmountCents: bigint;
    termMonths: number;
    purposeDetail: string | null;
    status: ApplicationStatus;
    riskScore: number | null;
    affordabilityPasses: boolean | null;
    declineReasonCodes: string[];
    policyVersion: string | null;
    submittedAt: Date | null;
    decisionAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ApplicationSnapshot {
    return {
      id: a.id,
      userId: a.userId,
      merchantId: a.merchantId,
      channel: a.channel,
      category: a.category,
      requestedAmountCents: a.requestedAmountCents,
      termMonths: a.termMonths,
      purposeDetail: a.purposeDetail,
      status: a.status,
      riskScore: a.riskScore,
      affordabilityPasses: a.affordabilityPasses,
      declineReasonCodes: a.declineReasonCodes,
      policyVersion: a.policyVersion,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      decisionAt: a.decisionAt?.toISOString() ?? null,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private auditPayload(a: {
    category: ApplicationSnapshot['category'];
    requestedAmountCents: bigint;
    termMonths: number;
    status: ApplicationStatus;
    channel: ApplicationSnapshot['channel'];
    merchantId: string | null;
  }): Record<string, unknown> {
    return {
      category: a.category,
      requestedAmountCents: a.requestedAmountCents.toString(),
      termMonths: a.termMonths,
      status: a.status,
      channel: a.channel,
      merchantId: a.merchantId,
    };
  }
}
