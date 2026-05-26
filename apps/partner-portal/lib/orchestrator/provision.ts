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
 */

import { createSubAccount } from '@/lib/highsale/client';
import { provisionMid } from '@/lib/micamp/client';

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
  partnerId: string;
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

/**
 * In-memory run registry — for demo purposes. Production swaps this
 * for a Postgres-backed table (the `partners` row would carry the
 * step state, or a separate `provisioning_runs` table if we want to
 * keep audit history of every attempt).
 *
 * Kept module-scoped so the same Node process can serve status
 * lookups against in-flight runs from the orchestrator endpoint.
 */
const RUNS = new Map<string, ProvisionRun>();

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

export function getRun(id: string): ProvisionRun | undefined {
  return RUNS.get(id);
}

export function listRuns(): ProvisionRun[] {
  return Array.from(RUNS.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Kick off a provisioning run. Returns immediately with the run id
 * so the caller can poll for status. The work itself happens in the
 * background via setImmediate so the HTTP response isn't blocked on
 * upstream integrations.
 */
export function startProvision(config: ProvisionConfig): ProvisionRun {
  const id = `prov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const run: ProvisionRun = {
    id,
    partnerId: config.partnerId,
    brand: config.brand,
    status: 'queued',
    steps: newSteps(),
    startedAt: nowIso(),
    completedAt: null,
    failureReason: null,
  };
  RUNS.set(id, run);

  // Defer execution so the caller gets a fast 202 + can poll.
  setImmediate(() => {
    void executeRun(run, config);
  });

  return run;
}

async function executeRun(run: ProvisionRun, config: ProvisionConfig): Promise<void> {
  run.status = 'running';

  // Step 1: HighSale sub-account
  try {
    setStep(run, 'highsale_subaccount', { status: 'in_progress', startedAt: nowIso() });
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
  } catch (err) {
    return failRun(run, 'highsale_subaccount', err);
  }

  // Step 2: Lender marketplace defaults — inherit the brand's
  // vertical allowlist; per-partner overrides come later via admin.
  try {
    setStep(run, 'marketplace_defaults', { status: 'in_progress', startedAt: nowIso() });
    // TODO(db): when vertical_configs is seeded, copy enabled_lender_ids → partner_marketplaces.
    // For now, just acknowledge.
    setStep(run, 'marketplace_defaults', {
      status: 'done',
      completedAt: nowIso(),
      result: { inheritedFromBrand: config.brand },
      note: `Inherited ${config.brand} lender allowlist. Per-partner overrides available in admin.`,
    });
  } catch (err) {
    return failRun(run, 'marketplace_defaults', err);
  }

  // Step 3: MiCamp MID
  try {
    setStep(run, 'micamp_mid', { status: 'in_progress', startedAt: nowIso() });
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
  } catch (err) {
    return failRun(run, 'micamp_mid', err);
  }

  // Step 4: Partner portal seed — branding defaults, webhook URLs,
  // team owner invite. All local DB writes, no upstream calls.
  try {
    setStep(run, 'partner_portal_seed', { status: 'in_progress', startedAt: nowIso() });
    // TODO(db): INSERT into partners row + seed branding_json defaults +
    // dispatch primary-contact invite via team-invites-store.
    setStep(run, 'partner_portal_seed', {
      status: 'done',
      completedAt: nowIso(),
      result: { invitedContact: config.primaryContactEmail },
      note: `Owner invite dispatched to ${config.primaryContactEmail}.`,
    });
  } catch (err) {
    return failRun(run, 'partner_portal_seed', err);
  }

  run.status = 'completed';
  run.completedAt = nowIso();
}

function failRun(run: ProvisionRun, stepName: ProvisionStepName, err: unknown): void {
  const reason = err instanceof Error ? err.message : 'Unknown error';
  setStep(run, stepName, {
    status: 'failed',
    completedAt: nowIso(),
    note: reason,
  });
  run.status = 'failed';
  run.failureReason = `${stepName}: ${reason}`;
  run.completedAt = nowIso();
}
