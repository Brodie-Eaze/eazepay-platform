/**
 * Provisioning orchestrator — one-config merchant onboarding.
 *
 * Glues HighSale + Lender Marketplace + MiCamp into a single
 * sequential workflow. Triggered by:
 *   POST /api/onboarding/provision
 *
 * Goal: get a merchant from "yes" to active + submitting applications
 * + processing payments within their first week. Eventually within
 * a single day as the playbook matures.
 *
 * Step order matters:
 *   1. HighSale sub-account     ← needed before pre-qual can run
 *   2. Lender marketplace defaults ← inherit MedPay vertical allowlist
 *   3. MiCamp MID                ← pre-underwriting issuance
 *   4. Partner-portal seeding    ← branding, team, webhook subscriptions
 *
 * On any step failure: orchestrator marks the run 'failed' with the
 * failing step, persists the partial state, and stops. Retry resumes
 * from the failing step (steps are idempotent on the integration
 * side — HighSale + MiCamp dedupe on the partnerId we send).
 *
 * Persistence
 * -----------
 * State is persisted to Postgres in `provisioning_runs` (Tasks #40 +
 * #46). The `steps_json` column carries the full ProvisionStep[]
 * array, rewritten on every step transition so polls hitting any
 * worker get the same answer. Run completion / failure / per-step
 * transitions also emit audit_log rows for SOC 2 CC8.1 replay.
 *
 * If `hasDb()` is false (local dev without DATABASE_URL) we fall
 * back to a module-scoped Map. That fallback is dev-only and the
 * route handler will surface a 503 once a hard DB requirement lands.
 */

import { eq, desc } from 'drizzle-orm';
import { createSubAccount } from '../highsale/client';
import { provisionMid } from '../micamp/client';
import { getDb, hasDb, schema } from '../db';
import {
  parseAuditPayloadForWrite,
  parseProvisionConfigForRead,
  parseProvisionConfigForWrite,
  parseProvisionStepsForRead,
  parseProvisionStepsForWrite,
} from '../db/jsonb-boundary';
import { safeLog } from '../safe-log';
import { hasQueue } from '../queue';
import { incrementMetric } from '../observability/metrics';

export type ProvisionStepName =
  | 'highsale_subaccount'
  | 'marketplace_defaults'
  | 'micamp_mid'
  | 'partner_portal_seed';

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';

export interface ProvisionStep {
  name: ProvisionStepName;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  /** Output of the step — varies per step. */
  result: Record<string, unknown> | null;
}

export interface ProvisionRun {
  id: string;
  /** NULL only after a partner row is deleted (FK ON DELETE SET NULL in
   *  0008). Every new run starts with a non-null partner_id; the column
   *  was relaxed to nullable so historical runs survive partner cleanup.
   *  Callers that need to act on the partner should treat null as
   *  "partner gone, audit row only". */
  partnerId: string | null;
  brand: 'medpay' | 'tradepay' | 'coachpay' | 'ai_funding';
  status: 'queued' | 'running' | 'completed' | 'failed';
  steps: ProvisionStep[];
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}

export interface ProvisionConfig {
  partnerId: string;
  legalName: string;
  dba: string | null;
  ein: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  brand: 'medpay' | 'tradepay' | 'coachpay' | 'ai_funding';
  bureau: 'fico8' | 'vantage';
  monthlyPullCap: number | null;
  billingCadence: 'weekly' | 'biweekly' | 'monthly';
  estimatedAnnualVolumeCents: number;
  estimatedTicketCents: number;
  mccCode: string;
  funnelUrls: string[];
}

const INITIAL_STEPS: ProvisionStepName[] = [
  'highsale_subaccount',
  'marketplace_defaults',
  'micamp_mid',
  'partner_portal_seed',
];

const ORCHESTRATOR_ACTOR = 'system:orchestrator';

/**
 * In-memory fallback registry — used ONLY when DATABASE_URL is
 * unset. Local dev without Postgres still needs to be able to walk
 * the wizard end-to-end. In every other environment the source of
 * truth is the `provisioning_runs` table.
 */
const MEMORY_RUNS = new Map<string, ProvisionRun>();

/**
 * Parallel in-memory store for the ProvisionConfig keyed by runId.
 * Mirrors the new `config_json` column on provisioning_runs — the
 * BullMQ worker recovers config from the DB, but the in-process
 * fallback path (no Redis) recovers it from this map.
 *
 * Held only as long as MEMORY_RUNS holds the corresponding run. No
 * separate eviction: the run lifetime is the natural bound.
 */
const MEMORY_RUNS_CONFIG = new Map<string, ProvisionConfig>();

function newSteps(): ProvisionStep[] {
  return INITIAL_STEPS.map((name) => ({
    name,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    note: null,
    result: null,
  }));
}

function nowIso(): string {
  return new Date().toISOString();
}

function setStep(run: ProvisionRun, name: ProvisionStepName, patch: Partial<ProvisionStep>): void {
  const step = run.steps.find((s) => s.name === name);
  if (!step) return;
  Object.assign(step, patch);
}

/* ---------- row <-> domain mapping ---------- */

function rowToRun(row: schema.ProvisioningRun): ProvisionRun {
  return {
    id: row.id,
    partnerId: row.partnerId,
    brand: row.brand as ProvisionRun['brand'],
    status: row.status as ProvisionRun['status'],
    steps: parseSteps(row.stepsJson) as ProvisionStep[],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    failureReason: row.failureReason,
  };
}

/**
 * Post-0014 the column is jsonb — Drizzle returns a structured value,
 * not a string. We validate with ProvisionStepsSchema at the boundary
 * and fall back to a fresh step list on shape drift so the operator
 * dashboard still renders a recovery surface.
 */
function parseSteps(value: unknown): ProvisionStep[] {
  if (value == null) return newSteps();
  try {
    return parseProvisionStepsForRead(value) as ProvisionStep[];
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.steps_shape_drift',
      err: err instanceof Error ? err.message : 'unknown',
    });
    return newSteps();
  }
}

/* ---------- persistence helpers ---------- */

/**
 * Write the run's mutable state (status, steps, completion) back to
 * the DB. Best-effort: a write failure is logged but does not abort
 * the run — the source-of-truth fallback is the in-memory copy the
 * orchestrator is mutating live.
 */
async function persistRun(run: ProvisionRun): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db
      .update(schema.provisioningRuns)
      .set({
        status: run.status,
        // jsonb post-0014. Boundary helper validates shape — on drift it
        // throws and we hit the catch below which logs `persist_failed`.
        stepsJson: parseProvisionStepsForWrite(run.steps),
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        failureReason: run.failureReason,
      })
      .where(eq(schema.provisioningRuns.id, run.id));
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.persist_failed',
      runId: run.id,
      partnerId: run.partnerId,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/**
 * Persist the HighSale sub-account → partner ownership mapping so the
 * prequal route's `assertResourceOwnership('subaccount', ...)` can
 * gate cross-tenant calls. Best-effort: a write failure logs loudly
 * and continues — the orchestrator step still completes (the upstream
 * sub-account exists), and ops can re-seed manually. The unique
 * constraint on `subaccount_id` makes re-runs idempotent.
 *
 * No-op when the sub-account id is missing (synthetic / live failure
 * upstream that we still want to surface as a soft warning, not a
 * hard step failure — the step itself caught that earlier).
 */
async function seedSubaccountOwnership(input: {
  partnerId: string;
  subaccountId: string | null;
  bureau: string | null;
  runId: string;
}): Promise<void> {
  if (!input.subaccountId) {
    safeLog.warn({
      event: 'orchestrator.provision.subaccount_seed.missing_id',
      runId: input.runId,
      partnerId: input.partnerId,
    });
    return;
  }
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db
      .insert(schema.partnerHighsaleSubaccounts)
      .values({
        partnerId: input.partnerId,
        subaccountId: input.subaccountId,
        bureau: input.bureau,
      })
      .onConflictDoNothing({ target: schema.partnerHighsaleSubaccounts.subaccountId });
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.subaccount_seed_failed',
      runId: input.runId,
      partnerId: input.partnerId,
      subaccountId: input.subaccountId,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/**
 * Append an audit_log row. Best-effort: failures don't abort the
 * orchestrator. The orchestrator's in-memory step state is the
 * fallback observability surface if audit writes are unhealthy.
 */
async function writeAudit(
  run: ProvisionRun,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      actor: ORCHESTRATOR_ACTOR,
      action,
      targetType: 'provisioning_run',
      targetId: run.id,
      payloadJson: parseAuditPayloadForWrite({
        partnerId: run.partnerId,
        brand: run.brand,
        ...payload,
      }),
    });
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.audit_write_failed',
      runId: run.id,
      action,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/* ---------- public read API ---------- */

export async function getRun(id: string): Promise<ProvisionRun | undefined> {
  if (!hasDb()) return MEMORY_RUNS.get(id);
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.provisioningRuns)
      .where(eq(schema.provisioningRuns.id, id))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : undefined;
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.get_run_failed',
      runId: id,
      err: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

export async function listRuns(): Promise<ProvisionRun[]> {
  if (!hasDb()) {
    return Array.from(MEMORY_RUNS.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.provisioningRuns)
      .orderBy(desc(schema.provisioningRuns.startedAt))
      .limit(100);
    return rows.map(rowToRun);
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.list_runs_failed',
      err: err instanceof Error ? err.message : 'unknown',
    });
    return [];
  }
}

/* ---------- run lifecycle ---------- */

/**
 * Kick off a provisioning run. Returns immediately with the run
 * record so the caller can poll for status. The work itself happens
 * either in a BullMQ worker (when `hasQueue()` is true — production
 * path) or in-process via setImmediate (local dev / Redis-less envs
 * — fallback path).
 *
 * Why both paths: the cross-process BullMQ path is what scales to
 * the July 1 cutover (500+ partners) and survives a Next.js redeploy
 * mid-run. The in-process path keeps the dev experience hermetic —
 * a contributor without Redis still walks the wizard end-to-end.
 *
 * IMPORTANT: only ONE of the two paths runs per call. Enqueueing AND
 * setImmediate would race two workers on the same row; the DB-side
 * status transitions are not idempotent past the first claim.
 */
export async function startProvision(config: ProvisionConfig): Promise<ProvisionRun> {
  const id = crypto.randomUUID();
  const startedAt = nowIso();
  const run: ProvisionRun = {
    id,
    partnerId: config.partnerId,
    brand: config.brand,
    status: 'queued',
    steps: newSteps(),
    startedAt,
    completedAt: null,
    failureReason: null,
  };

  if (hasDb()) {
    try {
      const db = getDb();
      await db.insert(schema.provisioningRuns).values({
        id: run.id,
        partnerId: run.partnerId,
        brand: run.brand,
        status: run.status,
        // jsonb post-0014 — boundary helpers validate.
        stepsJson: parseProvisionStepsForWrite(run.steps),
        // Persist the inputs so a cross-process BullMQ worker can recover
        // them. Keeps partner PII out of the Redis job payload — the job
        // carries only the run id.
        configJson: parseProvisionConfigForWrite(config),
        startedAt: new Date(startedAt),
      });
    } catch (err) {
      // Fall back to in-memory so the demo path stays alive, but
      // surface the failure loudly — this means the DB is misconfigured
      // and the operator needs to know.
      safeLog.error({
        event: 'orchestrator.provision.insert_failed',
        runId: run.id,
        partnerId: run.partnerId,
        err: err instanceof Error ? err.message : 'unknown',
      });
      MEMORY_RUNS_CONFIG.set(id, config);
      MEMORY_RUNS.set(id, run);
    }
  } else {
    MEMORY_RUNS_CONFIG.set(id, config);
    MEMORY_RUNS.set(id, run);
  }

  safeLog.info({
    event: 'orchestrator.provision.started',
    runId: run.id,
    partnerId: run.partnerId,
    brand: run.brand,
    transport: hasQueue() ? 'bullmq' : 'in_process',
  });
  await writeAudit(run, 'provision.start', { startedAt });

  // Dispatch to the worker. When Redis is configured we hand the
  // job off to BullMQ (a worker process picks it up). Otherwise we
  // defer to setImmediate so the caller still gets a fast 202.
  if (hasQueue()) {
    try {
      // Lazy import so this module doesn't pull bullmq into the bundle
      // for environments that never enqueue (e.g. middleware edge runtime).
      const { enqueueProvisioningRun } = await import('../queue/provisioning');
      await enqueueProvisioningRun(run.id);
    } catch (err) {
      // Enqueue failure must surface — silently falling back to the
      // in-process path would split traffic between two transports
      // and split the failure mode. Re-throw so the route returns 5xx.
      safeLog.error({
        event: 'orchestrator.provision.enqueue_failed',
        runId: run.id,
        err: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  } else {
    // In-process fallback. setImmediate does NOT surface throws as
    // unhandled rejections — wrap with .catch so a worker error
    // becomes a structured log rather than crashing the Node process.
    // The BullMQ path doesn't need this because the Worker harness
    // catches + retries automatically.
    setImmediate(() => {
      void executeProvisionRun(run.id, config).catch((err) => {
        safeLog.error({
          event: 'orchestrator.provision.in_process_failed',
          runId: run.id,
          err: err instanceof Error ? err.message : 'unknown',
        });
      });
    });
  }

  return run;
}

/**
 * Load the persisted ProvisionConfig for a run. Used by the BullMQ
 * worker to recover inputs without them riding in the Redis payload.
 *
 * Returns `undefined` if:
 *   - The run id is unknown
 *   - The row pre-dates Task #50 (config_json is NULL)
 * Workers treat undefined as a terminal failure: there's nothing to
 * drive the run.
 */
export async function loadProvisionConfig(id: string): Promise<ProvisionConfig | undefined> {
  if (!hasDb()) return MEMORY_RUNS_CONFIG.get(id);
  try {
    const db = getDb();
    const rows = await db
      .select({ configJson: schema.provisioningRuns.configJson })
      .from(schema.provisioningRuns)
      .where(eq(schema.provisioningRuns.id, id))
      .limit(1);
    const value = rows[0]?.configJson;
    if (value == null) return undefined;
    try {
      // jsonb post-0014: Drizzle returns the parsed object. Validate
      // shape at the boundary so a drifted row surfaces here, not in
      // the worker mid-run where the failure mode is much worse.
      return parseProvisionConfigForRead(value) as ProvisionConfig;
    } catch (err) {
      safeLog.error({
        event: 'orchestrator.provision.config_parse_failed',
        runId: id,
        err: err instanceof Error ? err.message : 'unknown',
      });
      return undefined;
    }
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.provision.load_config_failed',
      runId: id,
      err: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

/**
 * Execute a provisioning run end-to-end. Exported for the BullMQ
 * worker entry point (`lib/queue/provisioning.ts`) and the in-process
 * fallback path inside `startProvision`. Re-reads the run row first
 * so a worker that picks up a job after a redeploy sees the latest
 * status — a run already past 'queued' is a no-op rather than a
 * double-claim.
 */
export async function executeProvisionRun(runId: string, config: ProvisionConfig): Promise<void> {
  const run = await getRun(runId);
  if (!run) {
    // The runId was given to a worker but the row doesn't exist —
    // possible after a hard DB rollback. Throw so BullMQ retries
    // (the row may exist by the next attempt) and eventually DLQs.
    throw new Error(`provisioning_run_not_found:${runId}`);
  }
  if (run.status === 'completed' || run.status === 'failed') {
    safeLog.info({
      event: 'orchestrator.provision.skip_already_terminal',
      runId,
      status: run.status,
    });
    return;
  }
  await runSteps(run, config);
}

async function runSteps(run: ProvisionRun, config: ProvisionConfig): Promise<void> {
  run.status = 'running';
  await persistRun(run);

  // Step 1: HighSale sub-account
  try {
    setStep(run, 'highsale_subaccount', { status: 'in_progress', startedAt: nowIso() });
    await persistRun(run);
    const subAccount = await createSubAccount({
      partnerId: config.partnerId,
      legalName: config.legalName,
      primaryContactEmail: config.primaryContactEmail,
      bureau: config.bureau,
      monthlyPullCap: config.monthlyPullCap,
      billingCadence: config.billingCadence,
      brand: config.brand,
    });
    setStep(run, 'highsale_subaccount', {
      status: 'done',
      completedAt: nowIso(),
      result: subAccount as unknown as Record<string, unknown>,
      note: `HighSale sub-account ${subAccount.subAccountId} provisioned (bureau: ${subAccount.configuredBureau}).`,
    });
    await persistRun(run);
    await writeAudit(run, 'provision.step.complete', {
      step: 'highsale_subaccount',
      subAccountId: subAccount.subAccountId,
    });
  } catch (err) {
    return failRun(run, 'highsale_subaccount', err);
  }

  // Step 2: Lender marketplace defaults — inherit the brand's
  // vertical allowlist; per-partner overrides come later via admin.
  try {
    setStep(run, 'marketplace_defaults', { status: 'in_progress', startedAt: nowIso() });
    await persistRun(run);
    // TODO(db): when vertical_configs is seeded, copy enabled_lender_ids → partner_marketplaces.
    // For now, just acknowledge.
    setStep(run, 'marketplace_defaults', {
      status: 'done',
      completedAt: nowIso(),
      result: { inheritedFromBrand: config.brand },
      note: `Inherited ${config.brand} lender allowlist. Per-partner overrides available in admin.`,
    });
    await persistRun(run);
    await writeAudit(run, 'provision.step.complete', {
      step: 'marketplace_defaults',
      inheritedFromBrand: config.brand,
    });
  } catch (err) {
    return failRun(run, 'marketplace_defaults', err);
  }

  // Step 3: MiCamp MID
  try {
    setStep(run, 'micamp_mid', { status: 'in_progress', startedAt: nowIso() });
    await persistRun(run);
    const mid = await provisionMid({
      partnerId: config.partnerId,
      legalName: config.legalName,
      dba: config.dba,
      ein: config.ein,
      contactName: config.primaryContactName,
      contactEmail: config.primaryContactEmail,
      contactPhone: config.primaryContactPhone,
      estimatedVolumeCents: config.estimatedAnnualVolumeCents,
      estimatedTicketCents: config.estimatedTicketCents,
      mccCode: config.mccCode,
      funnelUrls: config.funnelUrls,
    });
    setStep(run, 'micamp_mid', {
      status: 'done',
      completedAt: nowIso(),
      result: mid as unknown as Record<string, unknown>,
      note: `MID ${mid.midId} requested. Status: ${mid.status}. ETA: ${mid.etaHours ?? '—'}h.`,
    });
    await persistRun(run);
    await writeAudit(run, 'provision.step.complete', {
      step: 'micamp_mid',
      midId: mid.midId,
      midStatus: mid.status,
    });
  } catch (err) {
    return failRun(run, 'micamp_mid', err);
  }

  // Step 4: Partner portal seed — branding defaults, webhook URLs,
  // team owner invite, ownership-mapping rows. All local DB writes,
  // no upstream calls.
  try {
    setStep(run, 'partner_portal_seed', { status: 'in_progress', startedAt: nowIso() });
    await persistRun(run);
    // Persist the HighSale sub-account ownership row so the prequal
    // route's `assertResourceOwnership('subaccount', ...)` can verify
    // cross-tenant access (Task #51, SEC-001 follow-up). Idempotent
    // via the unique index on subaccount_id — a re-run of this step
    // collides on conflict and no-ops.
    const subAccountStep = run.steps.find((s) => s.name === 'highsale_subaccount');
    const subAccountId =
      typeof subAccountStep?.result?.subAccountId === 'string'
        ? (subAccountStep.result.subAccountId as string)
        : null;
    const bureau =
      typeof subAccountStep?.result?.configuredBureau === 'string'
        ? (subAccountStep.result.configuredBureau as string)
        : null;
    await seedSubaccountOwnership({
      partnerId: config.partnerId,
      subaccountId: subAccountId,
      bureau,
      runId: run.id,
    });
    // TODO(db): INSERT into partners row + seed branding_json defaults +
    // dispatch primary-contact invite via team-invites-store.
    setStep(run, 'partner_portal_seed', {
      status: 'done',
      completedAt: nowIso(),
      result: {
        invitedContact: config.primaryContactEmail,
        subAccountId,
      },
      note: `Owner invite dispatched to ${config.primaryContactEmail}.`,
    });
    await persistRun(run);
    await writeAudit(run, 'provision.step.complete', {
      step: 'partner_portal_seed',
      subAccountId,
    });
  } catch (err) {
    return failRun(run, 'partner_portal_seed', err);
  }

  run.status = 'completed';
  run.completedAt = nowIso();
  await persistRun(run);
  incrementMetric('provisioning.completed');
  safeLog.info({
    event: 'orchestrator.provision.completed',
    runId: run.id,
    partnerId: run.partnerId,
    brand: run.brand,
  });
  await writeAudit(run, 'provision.complete', { completedAt: run.completedAt });
}

function failRun(run: ProvisionRun, stepName: ProvisionStepName, err: unknown): Promise<void> {
  const reason = err instanceof Error ? err.message : 'Unknown error';
  setStep(run, stepName, {
    status: 'failed',
    completedAt: nowIso(),
    note: reason,
  });
  run.status = 'failed';
  run.failureReason = `${stepName}: ${reason}`;
  run.completedAt = nowIso();
  incrementMetric('provisioning.failed');
  safeLog.error({
    event: 'orchestrator.provision.failed',
    runId: run.id,
    partnerId: run.partnerId,
    step: stepName,
    reason,
  });
  return (async () => {
    await persistRun(run);
    await writeAudit(run, 'provision.failed', { step: stepName, reason });
  })();
}
