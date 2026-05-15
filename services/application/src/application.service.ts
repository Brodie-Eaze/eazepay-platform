import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { sha256Hex } from '@eazepay/shared-utils';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { WEBHOOK_PUBLISHER, type WebhookPublisher } from '@eazepay/service-webhook';
import { PRISMA } from './internal/tokens.js';
import { POST_SUBMIT_HOOK, type PostSubmitHook } from './ports/post-submit.port.js';
import {
  CONTRACTED_HOOK,
  type ContractedHook,
} from './ports/contracted-hook.port.js';
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
    @Inject(CONTRACTED_HOOK) private readonly contractedHook: ContractedHook,
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
    @Optional() @Inject(WEBHOOK_PUBLISHER) private readonly webhooks?: WebhookPublisher,
  ) {}

  /**
   * Create a draft Application.
   *
   * SEC-026 (IP velocity): `requestCtx.ipAddress` and `userAgent`, when
   * provided by the caller, are written into the `application.created`
   * audit row's `after` payload AND into the top-level `ip_address` /
   * `user_agent` columns of `audit_outbox`. The risk service's
   * application-velocity check (services/risk/src/risk.service.ts)
   * counts `application.created` rows where `after.ipAddress` matches
   * the submitter's IP in a rolling window — without this fix the
   * count is always zero (the field was never written) and the
   * velocity gate is effectively dead code.
   *
   * Callers MUST pass the controller's request IP + UA. Callers that
   * don't have a request context (e.g. backfill scripts) may omit
   * `requestCtx` — the audit row will still be written but the
   * velocity check won't see those rows. That's intentional: a
   * script-initiated application has no meaningful IP signal.
   */
  async create(
    userId: UserId,
    dto: CreateApplicationDto,
    requestCtx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<ApplicationSnapshot> {
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
          after: this.auditPayload(app, requestCtx),
          ipAddress: requestCtx.ipAddress ?? null,
          userAgent: requestCtx.userAgent ?? null,
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

  async submit(
    userId: UserId,
    applicationId: ApplicationId,
    ctx: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string } = {},
  ): Promise<ApplicationSnapshot> {
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
      .onSubmitted(result.id, ctx)
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
      return this.completeContractSigned(userId, accepted.app.id as ApplicationId);
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
      //
      // SEC-038 / scale: `loans.offer_id` carries a UNIQUE constraint
      // (`loans_offer_id_key`, see init migration). If
      // `completeContractSigned` is called twice in parallel for the
      // same offer — for example a webhook retry racing the
      // controller's own call — both transactions enter here past the
      // application-status idempotency guard (the second sees status
      // still 'accepted' at READ time). The DB then rejects the second
      // insert with Prisma error P2002. We swallow that as the
      // idempotent path and re-load the existing Loan row, rather than
      // surfacing a 409 to a webhook that already accepted the event.
      let loan: { id: string };
      try {
        loan = await tx.loan.create({
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
          select: { id: true },
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err as { code?: string }).code === 'P2002'
        ) {
          this.logger.warn(
            { applicationId: app.id, offerId: offer.id },
            'loan_already_exists_idempotent — concurrent CONTRACT_SIGNED collapsed by UNIQUE(offer_id)',
          );
          const existing = await tx.loan.findUniqueOrThrow({
            where: { offerId: offer.id },
            select: { id: true },
          });
          loan = existing;
        } else {
          throw err;
        }
      }

      await tx.auditOutbox.create({
        data: {
          actorType: args.actorType,
          actorId: args.userId,
          action: 'application.contracted',
          targetType: 'Application',
          targetId: app.id,
          after: { offerId: offer.id, loanId: loan.id, lenderOfRecord: offer.lenderOfRecord },
        },
      });

      const refreshed = await tx.application.findUniqueOrThrow({ where: { id: app.id } });
      // Fire ContractedHook AFTER the transaction commits. Disbursement
      // is intentionally separated from the contract-signing transaction
      // so a payment-rail outage doesn't roll back a signed agreement.
      // Hook may run for many seconds (ACH origination); we don't await.
      const hookArgs = { applicationId: app.id, loanId: loan.id };
      void this.contractedHook
        .onContracted(hookArgs)
        .catch((err) => this.logger.error({ err, ...hookArgs }, 'contracted hook failed'));

      // Notify the consumer that the agreement is signed. Funding-
      // success notification fires later from PaymentService.
      if (this.notify) {
        void this.notify
          .notify({
            userId: app.userId,
            templateKey: 'application.contracted',
            payload: { lenderOfRecord: offer.lenderOfRecord },
            subjectType: 'Application',
            subjectId: app.id,
          })
          .catch((err) => this.logger.error({ err }, 'contracted notify failed'));
      }
      if (this.webhooks && app.merchantId) {
        void this.webhooks
          .publish({
            eventType: 'application.contracted',
            eventId: `application.contracted:${app.id}`,
            subjectType: 'Application',
            subjectId: app.id,
            merchantId: app.merchantId,
            payload: { offerId: offer.id, lenderOfRecord: offer.lenderOfRecord },
          })
          .catch((err) => this.logger.error({ err }, 'contracted webhook failed'));
      }
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

  private auditPayload(
    a: {
      category: ApplicationSnapshot['category'];
      requestedAmountCents: bigint;
      termMonths: number;
      status: ApplicationStatus;
      channel: ApplicationSnapshot['channel'];
      merchantId: string | null;
    },
    requestCtx: { ipAddress?: string; userAgent?: string } = {},
  ): object {
    return {
      category: a.category,
      requestedAmountCents: a.requestedAmountCents.toString(),
      termMonths: a.termMonths,
      status: a.status,
      channel: a.channel,
      merchantId: a.merchantId,
      // SEC-026: surfaced into `after` so the risk service's IP
      // velocity query (which uses Prisma's `path:['ipAddress']`
      // containment lookup) can find a value to count. `undefined`
      // keys are stripped by the Prisma JSON serializer, so omitting
      // the IP for script-initiated calls is safe.
      ...(requestCtx.ipAddress ? { ipAddress: requestCtx.ipAddress } : {}),
      ...(requestCtx.userAgent ? { userAgent: requestCtx.userAgent } : {}),
    };
  }
}
