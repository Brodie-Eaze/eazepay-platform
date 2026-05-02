import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { POST_SUBMIT_HOOK, type PostSubmitHook } from './ports/post-submit.port.js';
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
