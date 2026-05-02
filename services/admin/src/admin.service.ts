import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type ApplicationStatus, type RiskFlagSeverity } from '@prisma/client';
import { NotFound } from '@eazepay/shared-utils';
import { PRISMA } from './internal/tokens.js';

interface PageOpts {
  cursor?: string;
  limit: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Application queue. Default surfaces manual-review-eligible work
   * (status `submitted` / `underwriting` / `offers_presented` whose
   * latest RiskAssessment recommends manual_review). Filters by status
   * + risk recommendation are caller-controllable.
   *
   * Every read by an admin writes an audit row at the controller level —
   * NOT here — so we don't double-audit on internal joins.
   */
  async listApplicationQueue(opts: {
    status?: ApplicationStatus[];
    riskRecommendation?: 'manual_review' | 'decline' | 'accept';
    paging: PageOpts;
  }): Promise<{
    items: Array<{
      id: string;
      userId: string;
      merchantId: string | null;
      status: ApplicationStatus;
      category: string;
      requestedAmountCents: bigint;
      submittedAt: string | null;
      riskScore: number | null;
      riskRecommendation: string | null;
      riskReasonCodes: string[];
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const items = await this.prisma.application.findMany({
      where: {
        ...(opts.status ? { status: { in: opts.status } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });

    const ids = items.map((a) => a.id);
    const assessments = await this.prisma.riskAssessment.findMany({
      where: { applicationId: { in: ids } },
    });
    const byApp = new Map(assessments.map((a) => [a.applicationId, a]));

    const filtered = opts.riskRecommendation
      ? items.filter((a) => byApp.get(a.id)?.recommendation === opts.riskRecommendation)
      : items;

    const hasMore = filtered.length > opts.paging.limit;
    const sliced = hasMore ? filtered.slice(0, opts.paging.limit) : filtered;
    return {
      items: sliced.map((a) => {
        const r = byApp.get(a.id);
        return {
          id: a.id,
          userId: a.userId,
          merchantId: a.merchantId,
          status: a.status,
          category: a.category,
          requestedAmountCents: a.requestedAmountCents,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          riskScore: r?.score ?? null,
          riskRecommendation: r?.recommendation ?? null,
          riskReasonCodes: r?.reasonCodes ?? [],
          createdAt: a.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  /**
   * Admin-side application detail. Returns the full picture: application
   * + user + merchant context (if any) + offers + lender routes + risk
   * assessment + flags + (masked) PII. PII unmasking requires a
   * just-in-time access elevation in production — at MVP we surface the
   * underlying ConsumerProfile metadata only (no decryption here).
   */
  async getApplicationDetail(applicationId: string): Promise<unknown> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: { id: true, email: true, phoneE164: true, status: true, kycStatus: true },
        },
        offers: { orderBy: { rank: 'asc' } },
        contracts: true,
        loans: true,
      },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });

    const [routes, risk, flags] = await Promise.all([
      this.prisma.lenderRoute.findMany({
        where: { applicationId },
        orderBy: { evaluationOrder: 'asc' },
        include: { lender: { select: { adapterKey: true, legalName: true } } },
      }),
      this.prisma.riskAssessment.findUnique({ where: { applicationId } }),
      this.prisma.riskFlag.findMany({
        where: {
          OR: [
            { subjectType: 'Application', subjectId: applicationId },
            { subjectType: 'User', subjectId: app.userId },
          ],
        },
        orderBy: { raisedAt: 'desc' },
      }),
    ]);

    return {
      application: {
        id: app.id,
        status: app.status,
        channel: app.channel,
        category: app.category,
        requestedAmountCents: app.requestedAmountCents,
        termMonths: app.termMonths,
        purposeDetail: app.purposeDetail,
        riskScore: app.riskScore,
        affordabilityPasses: app.affordabilityPasses,
        declineReasonCodes: app.declineReasonCodes,
        policyVersion: app.policyVersion,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        decisionAt: app.decisionAt?.toISOString() ?? null,
        createdAt: app.createdAt.toISOString(),
      },
      user: app.user,
      merchantId: app.merchantId,
      offers: app.offers,
      contracts: app.contracts,
      loans: app.loans,
      lenderRoutes: routes.map((r) => ({
        id: r.id,
        order: r.evaluationOrder,
        outcome: r.outcome,
        reasonCodes: r.reasonCodes,
        latencyMs: r.evaluationLatencyMs,
        evaluatedAt: r.evaluatedAt.toISOString(),
        lender: r.lender,
      })),
      riskAssessment: risk,
      riskFlags: flags,
    };
  }

  /**
   * Audit log viewer (cursor-paginated). Supports filters by target +
   * action prefix + actor + time window. Read-only — there is no
   * admin-side mutation of audit rows.
   */
  async listAuditLogs(opts: {
    targetType?: string;
    targetId?: string;
    actionPrefix?: string;
    actorId?: string;
    sinceIso?: string;
    paging: PageOpts;
  }): Promise<{
    items: Array<{
      id: string;
      actorType: string;
      actorId: string | null;
      action: string;
      targetType: string;
      targetId: string;
      before: unknown;
      after: unknown;
      occurredAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const items = await this.prisma.auditOutbox.findMany({
      where: {
        ...(opts.targetType ? { targetType: opts.targetType } : {}),
        ...(opts.targetId ? { targetId: opts.targetId } : {}),
        ...(opts.actorId ? { actorId: opts.actorId } : {}),
        ...(opts.actionPrefix ? { action: { startsWith: opts.actionPrefix } } : {}),
        ...(opts.sinceIso ? { occurredAt: { gte: new Date(opts.sinceIso) } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });
    const hasMore = items.length > opts.paging.limit;
    const sliced = hasMore ? items.slice(0, opts.paging.limit) : items;
    return {
      items: sliced.map((a) => ({
        id: a.id,
        actorType: a.actorType,
        actorId: a.actorId,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        before: a.before,
        after: a.after,
        occurredAt: a.occurredAt.toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  /** Open risk flags, optionally filtered by minimum severity. */
  async listOpenRiskFlags(opts: {
    minSeverity?: RiskFlagSeverity;
    paging: PageOpts;
  }): Promise<unknown> {
    const order: Record<RiskFlagSeverity, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    const items = await this.prisma.riskFlag.findMany({
      where: { resolvedAt: null },
      orderBy: { raisedAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });
    const filtered = opts.minSeverity
      ? items.filter((f) => order[f.severity] >= order[opts.minSeverity!])
      : items;
    const hasMore = filtered.length > opts.paging.limit;
    const sliced = hasMore ? filtered.slice(0, opts.paging.limit) : filtered;
    return {
      items: sliced,
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }
}
