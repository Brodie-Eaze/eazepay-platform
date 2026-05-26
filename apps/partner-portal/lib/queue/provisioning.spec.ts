import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Specs for the provisioning queue wiring (Task #50).
 *
 * Scope: contract tests for `processProvisioningJob` — the BullMQ
 * processor entry point that the Worker calls per job. We don't
 * exercise the actual Worker / Queue here because that requires a
 * live Redis; integration tests live behind an ENV flag (search for
 * `LIVE_REDIS_INTEGRATION` in scripts/test-with-redis.ts when it
 * lands).
 *
 * Coverage:
 *   1. processProvisioningJob fetches the run's config via
 *      loadProvisionConfig and delegates to executeProvisionRun.
 *   2. A missing config (row pre-dates Task #50, or row doesn't
 *      exist) throws so BullMQ DLQs the job.
 *   3. `processProvisioningJob` is idempotent on a successful
 *      executeProvisionRun (no-op if the row already terminal).
 */

// vi.mock is hoisted above any `const` in the file. Use vi.hoisted
// to lift the fn refs alongside the hoisted mock factory.
const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  executeRun: vi.fn(),
}));

vi.mock('../orchestrator/provision', () => ({
  loadProvisionConfig: mocks.loadConfig,
  executeProvisionRun: mocks.executeRun,
}));

vi.mock('../safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./dlq', () => ({
  recordTerminalFailure: vi.fn(),
}));

// The queue module imports `./index` (the Redis singleton) eagerly.
// We don't need Redis for the unit-level processor test — stub it.
vi.mock('./index', () => ({
  getConnection: vi.fn(() => {
    throw new Error('getConnection should not be called in unit specs');
  }),
  hasQueue: vi.fn(() => false),
}));

const loadConfigMock = mocks.loadConfig;
const executeRunMock = mocks.executeRun;

import { processProvisioningJob } from './provisioning';
import type { Job } from 'bullmq';

function buildJob(runId: string): Job<{ runId: string }> {
  // Cast through unknown: BullMQ's Job has 30+ private fields the
  // unit test doesn't need. The processor only reads job.data.
  return { data: { runId } } as unknown as Job<{ runId: string }>;
}

const BASE_CONFIG = {
  partnerId: 'p_test',
  legalName: 'Test Co',
  dba: null,
  ein: '12-3456789',
  primaryContactName: 'Owner',
  primaryContactEmail: 'owner@test.example',
  primaryContactPhone: '555-0100',
  brand: 'medpay' as const,
  bureau: 'fico8' as const,
  monthlyPullCap: 500,
  billingCadence: 'biweekly' as const,
  estimatedAnnualVolumeCents: 100_000_00,
  estimatedTicketCents: 4_500_00,
  mccCode: '8099',
  funnelUrls: [],
};

describe('processProvisioningJob', () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    executeRunMock.mockReset();
  });

  it('loads the config + delegates to executeProvisionRun on the happy path', async () => {
    const runId = '00000000-0000-4000-8000-000000000001';
    loadConfigMock.mockResolvedValue(BASE_CONFIG);
    executeRunMock.mockResolvedValue(undefined);

    await processProvisioningJob(buildJob(runId));

    expect(loadConfigMock).toHaveBeenCalledWith(runId);
    expect(executeRunMock).toHaveBeenCalledWith(runId, BASE_CONFIG);
  });

  it('throws on missing config so BullMQ retries + eventually DLQs', async () => {
    const runId = '00000000-0000-4000-8000-000000000002';
    loadConfigMock.mockResolvedValue(undefined);

    await expect(processProvisioningJob(buildJob(runId))).rejects.toThrow(
      /provisioning_run_config_missing/,
    );
    expect(executeRunMock).not.toHaveBeenCalled();
  });

  it('propagates a transient error from executeProvisionRun so BullMQ retries', async () => {
    const runId = '00000000-0000-4000-8000-000000000003';
    loadConfigMock.mockResolvedValue(BASE_CONFIG);
    executeRunMock.mockRejectedValueOnce(new Error('HighSale 503'));

    await expect(processProvisioningJob(buildJob(runId))).rejects.toThrow('HighSale 503');
  });

  it('is safe to invoke twice on the same runId (executeProvisionRun owns idempotency)', async () => {
    const runId = '00000000-0000-4000-8000-000000000004';
    loadConfigMock.mockResolvedValue(BASE_CONFIG);
    executeRunMock.mockResolvedValue(undefined);

    await processProvisioningJob(buildJob(runId));
    await processProvisioningJob(buildJob(runId));

    expect(executeRunMock).toHaveBeenCalledTimes(2);
    // The downstream executeProvisionRun is responsible for no-op'ing
    // on a terminal status — see orchestrator/provision.spec.ts for
    // that contract.
  });
});
