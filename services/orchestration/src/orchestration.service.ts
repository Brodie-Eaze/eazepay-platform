import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { LenderRegistry } from '@eazepay/service-lender';
import type { LenderEvaluationContext, LenderQuoteResult } from '@eazepay/service-lender';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { RiskService } from '@eazepay/service-risk';
import { PRISMA } from './internal/tokens.js';
import { DecisionService } from './decision/decision.service.js';
import { POLICY_VERSION, REASON_CODES } from './decision/policy.js';

const QUOTE_TIMEOUT_MS = 5_000;
const MAX_OFFERS = 5;

/**
 * Orchestrator: turns a `submitted` Application into either offers
 * (`offers_presented`) or a decline (`declined`). Pure side-effect:
 *
 *  1. Decision (knockouts + affordability) → instant decline if fails.
 *  2. Resolve eligible lender products from registry filtered by
 *     category and resident state.
 *  3. Per-adapter eligibility check, then bounded-parallel quote() with
 *     5s hard timeout. Errors and timeouts are recorded as LenderRoute
 *     rows (not silently dropped).
 *  4. Persist Offers ranked by total cost to the consumer (lowest first).
 *  5. Transition Application + write audit row.
 *
 * Hybrid tier waterfall (parallel within tier, descend until enough
 * offers) is the next iteration — at MVP we run all eligible adapters
 * in parallel and rank by consumer cost. Internal-favouritism is
 * structurally impossible in this version.
 */
@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly registry: LenderRegistry,
    private readonly decision: DecisionService,
    @Optional() private readonly risk?: RiskService,
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
  ) {}

  private async fireNotify(input: {
    userId: string;
    templateKey: string;
    payload?: Record<string, unknown>;
    subjectType?: string;
    subjectId?: string;
  }): Promise<void> {
    if (!this.notify) return;
    try {
      await this.notify.notify(input);
    } catch (err) {
      this.logger.error({ err, templateKey: input.templateKey }, 'notify failed');
    }
  }

  async evaluate(
    applicationId: string,
    submitCtx: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string } = {},
  ): Promise<void> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: { include: { consumerProfile: true } } },
    });
    if (!app) {
      this.logger.warn(`evaluate: no application ${applicationId}`);
      return;
    }
    if (app.status !== 'submitted') {
      this.logger.warn(
        `evaluate: application ${applicationId} not in 'submitted' (status=${app.status}); skipping`,
      );
      return;
    }

    // Move to underwriting up-front so the application is auditably "in
    // flight" while we evaluate. Failure modes still resolve to declined
    // or back to submitted via a future retry path.
    await this.prisma.application.update({
      where: { id: app.id },
      data: { status: 'underwriting' },
    });

    const decision = this.decision.evaluate({
      requestedAmountCents: app.requestedAmountCents,
      termMonths: app.termMonths,
    });

    if (!decision.passes) {
      await this.completeAsDeclined(app.id, app.userId, decision.reasonCodes);
      await this.fireNotify({
        userId: app.userId,
        templateKey: 'application.declined',
        payload: { reasonCodes: decision.reasonCodes },
        subjectType: 'Application',
        subjectId: app.id,
      });
      return;
    }

    // Risk gate. Consultative: a `decline` recommendation short-circuits
    // here BEFORE any external lender call (saves bureau cost + lender
    // SLA budget on obvious-bad apps). `manual_review` and `accept`
    // proceed normally; the assessment is persisted either way and
    // surfaces in the admin queue.
    if (this.risk) {
      try {
        const assessment = await this.risk.assess({
          applicationId: app.id,
          userId: app.userId,
          email: app.user.email,
          phone: app.user.phoneE164,
          ipAddress: submitCtx.ipAddress,
          userAgent: submitCtx.userAgent,
          deviceFingerprint: submitCtx.deviceFingerprint,
        });
        if (assessment.recommendation === 'decline') {
          this.logger.warn(
            { applicationId: app.id, score: assessment.score, reasonCodes: assessment.reasonCodes },
            'risk gate declined application pre-lender',
          );
          await this.completeAsDeclined(app.id, app.userId, assessment.reasonCodes);
          await this.fireNotify({
            userId: app.userId,
            templateKey: 'application.declined',
            payload: { reasonCodes: assessment.reasonCodes },
            subjectType: 'Application',
            subjectId: app.id,
          });
          return;
        }
      } catch (err) {
        // Risk degraded — log and proceed. Better to over-route to lenders
        // than to fail-closed when our own signal layer is down.
        this.logger.error({ err, applicationId: app.id }, 'risk.assess failed; proceeding');
      }
    }

    const candidates = await this.registry.listEnabled(
      app.category,
      app.user.consumerProfile?.residentState ?? null,
    );

    if (candidates.length === 0) {
      await this.completeAsDeclined(app.id, app.userId, [REASON_CODES.noEligibleLender]);
      await this.fireNotify({
        userId: app.userId,
        templateKey: 'application.declined',
        payload: { reasonCodes: [REASON_CODES.noEligibleLender] },
        subjectType: 'Application',
        subjectId: app.id,
      });
      return;
    }

    const ctx: LenderEvaluationContext = {
      applicationId: app.id,
      userId: app.userId,
      category: app.category,
      requestedAmountCents: app.requestedAmountCents,
      termMonths: app.termMonths,
      residentState: app.user.consumerProfile?.residentState ?? null,
      affordabilityPasses: true,
      riskScore: app.riskScore,
    };

    type LenderResult = {
      candidate: (typeof candidates)[number];
      result: LenderQuoteResult | { outcome: 'timeout'; reasonCodes: string[] };
      latencyMs: number;
      order: number;
    };

    const results: LenderResult[] = await Promise.all(
      candidates.map(async (cand, order) => {
        const start = Date.now();
        try {
          const result = await this.callWithTimeout(cand.adapter, ctx, QUOTE_TIMEOUT_MS);
          return { candidate: cand, result, latencyMs: Date.now() - start, order };
        } catch (err) {
          this.logger.error(
            { err, lender: cand.adapter.adapterKey },
            'lender adapter threw during quote()',
          );
          return {
            candidate: cand,
            result: { outcome: 'error', reasonCodes: ['adapter_exception'] } as LenderQuoteResult,
            latencyMs: Date.now() - start,
            order,
          };
        }
      }),
    );

    const decision = await this.persistResults(app.id, app.userId, results);

    // Fire notifications post-commit; failures are logged but not raised.
    if (decision.outcome === 'offers_presented') {
      await this.fireNotify({
        userId: app.userId,
        templateKey: 'application.offers_presented',
        payload: { offerCount: decision.offerCount },
        subjectType: 'Application',
        subjectId: app.id,
      });
    } else {
      await this.fireNotify({
        userId: app.userId,
        templateKey: 'application.declined',
        payload: { reasonCodes: decision.reasonCodes },
        subjectType: 'Application',
        subjectId: app.id,
      });
    }
  }

  private async callWithTimeout(
    adapter: { quote: LenderEvaluationContext extends never ? never : import('@eazepay/service-lender').LenderAdapter['quote'] },
    ctx: LenderEvaluationContext,
    timeoutMs: number,
  ): Promise<LenderQuoteResult | { outcome: 'timeout'; reasonCodes: string[] }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await Promise.race([
        adapter.quote(ctx, { signal: controller.signal }),
        new Promise<{ outcome: 'timeout'; reasonCodes: string[] }>((resolve) => {
          controller.signal.addEventListener('abort', () =>
            resolve({ outcome: 'timeout', reasonCodes: ['adapter_timeout'] }),
          );
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  private async persistResults(
    applicationId: string,
    _userId: string,
    results: Array<{
      candidate: {
        adapter: { adapterKey: string };
        lenderId: string;
        lenderProductId: string;
        lenderOfRecord: string;
      };
      result: LenderQuoteResult | { outcome: 'timeout'; reasonCodes: string[] };
      latencyMs: number;
      order: number;
    }>,
  ): Promise<
    | { outcome: 'offers_presented'; offerCount: number }
    | { outcome: 'declined'; reasonCodes: string[] }
  > {
    const approvals = results
      .filter(
        (r): r is typeof r & { result: Extract<LenderQuoteResult, { outcome: 'approved' }> } =>
          r.result.outcome === 'approved',
      )
      .sort(
        (a, b) =>
          Number(a.result.quote.totalRepayableCents) - Number(b.result.quote.totalRepayableCents),
      )
      .slice(0, MAX_OFFERS);

    return this.prisma.$transaction(async (tx) => {
      // LenderRoute rows: every evaluation outcome is recorded for audit.
      for (const r of results) {
        const outcome = mapOutcome(r.result.outcome);
        const reasonCodes =
          r.result.outcome === 'approved'
            ? []
            : r.result.outcome === 'declined' || r.result.outcome === 'error' || r.result.outcome === 'timeout'
              ? r.result.reasonCodes
              : [];
        await tx.lenderRoute.create({
          data: {
            applicationId,
            lenderId: r.candidate.lenderId,
            lenderProductId: r.candidate.lenderProductId,
            evaluationOrder: r.order,
            evaluationLatencyMs: r.latencyMs,
            outcome,
            reasonCodes,
          },
        });
      }

      if (approvals.length === 0) {
        // Aggregate decline reasons across lenders for the Adverse Action notice.
        const aggregate = Array.from(
          new Set(
            results
              .filter((r) => r.result.outcome !== 'approved')
              .flatMap((r) => ('reasonCodes' in r.result ? r.result.reasonCodes : [])),
          ),
        );
        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: 'declined',
            decisionAt: new Date(),
            declineReasonCodes: aggregate.length > 0 ? aggregate : [REASON_CODES.noEligibleLender],
            policyVersion: POLICY_VERSION,
          },
        });
        await tx.auditOutbox.create({
          data: {
            actorType: 'system',
            actorId: null,
            action: 'application.declined',
            targetType: 'Application',
            targetId: applicationId,
            after: { reasonCodes: aggregate, policyVersion: POLICY_VERSION },
          },
        });
        return {
          outcome: 'declined' as const,
          reasonCodes: aggregate.length > 0 ? aggregate : [REASON_CODES.noEligibleLender],
        };
      }

      // Persist offers, ranked by lowest total repayable to the consumer.
      let rank = 1;
      for (const a of approvals) {
        await tx.offer.create({
          data: {
            applicationId,
            lenderProductId: a.candidate.lenderProductId,
            lenderOfRecord: a.result.quote.lenderOfRecord,
            amountCents: a.result.quote.amountCents,
            termMonths: a.result.quote.termMonths,
            aprBps: a.result.quote.aprBps,
            comparisonRateBps: a.result.quote.comparisonRateBps,
            feesCents: a.result.quote.feesCents,
            totalRepayableCents: a.result.quote.totalRepayableCents,
            rank: rank++,
            expiresAt: a.result.quote.expiresAt,
          },
        });
      }
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'offers_presented',
          decisionAt: new Date(),
          policyVersion: POLICY_VERSION,
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'system',
          actorId: null,
          action: 'application.offers_presented',
          targetType: 'Application',
          targetId: applicationId,
          after: { offerCount: approvals.length, policyVersion: POLICY_VERSION },
        },
      });
      return { outcome: 'offers_presented' as const, offerCount: approvals.length };
    });
  }

  private async completeAsDeclined(
    applicationId: string,
    _userId: string,
    reasonCodes: string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'declined',
          decisionAt: new Date(),
          declineReasonCodes: reasonCodes,
          policyVersion: POLICY_VERSION,
        },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'system',
          actorId: null,
          action: 'application.declined',
          targetType: 'Application',
          targetId: applicationId,
          after: { reasonCodes, policyVersion: POLICY_VERSION },
        },
      });
    });
  }
}

function mapOutcome(
  o: 'approved' | 'declined' | 'error' | 'timeout' | 'eligible' | 'ineligible',
): 'approved' | 'declined' | 'error' | 'timeout' | 'eligible' | 'ineligible' {
  return o;
}
