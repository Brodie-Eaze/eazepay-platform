import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Specs for the migrations queue wiring (Task #50).
 *
 * Same shape as provisioning.spec.ts — contract tests for the
 * processor's wiring into the orchestrator entry point. Integration
 * tests against a live Worker live behind an ENV flag (see
 * scripts/test-with-redis.ts when it lands).
 */

const mocks = vi.hoisted(() => ({
  executeMigration: vi.fn(),
}));

vi.mock('../orchestrator/migration', () => ({
  executeMigrationRun: mocks.executeMigration,
}));

const executeMigrationMock = mocks.executeMigration;

vi.mock('../safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./dlq', () => ({
  recordTerminalFailure: vi.fn(),
}));

vi.mock('./index', () => ({
  getConnection: vi.fn(() => {
    throw new Error('getConnection should not be called in unit specs');
  }),
  hasQueue: vi.fn(() => false),
}));

import { processMigrationJob } from './migrations';
import type { Job } from 'bullmq';

function buildJob(migrationId: string): Job<{ migrationId: string }> {
  return { data: { migrationId } } as unknown as Job<{ migrationId: string }>;
}

describe('processMigrationJob', () => {
  beforeEach(() => {
    executeMigrationMock.mockReset();
  });

  it('delegates to executeMigrationRun on the happy path', async () => {
    const id = '00000000-0000-4000-8000-000000000010';
    executeMigrationMock.mockResolvedValue(undefined);

    await processMigrationJob(buildJob(id));

    expect(executeMigrationMock).toHaveBeenCalledWith(id);
  });

  it('propagates errors from executeMigrationRun so BullMQ retries', async () => {
    const id = '00000000-0000-4000-8000-000000000011';
    executeMigrationMock.mockRejectedValueOnce(new Error('source lookup transient'));

    await expect(processMigrationJob(buildJob(id))).rejects.toThrow('source lookup transient');
  });

  it('is safe to invoke twice — executeMigrationRun owns idempotency', async () => {
    const id = '00000000-0000-4000-8000-000000000012';
    executeMigrationMock.mockResolvedValue(undefined);

    await processMigrationJob(buildJob(id));
    await processMigrationJob(buildJob(id));

    expect(executeMigrationMock).toHaveBeenCalledTimes(2);
  });
});
