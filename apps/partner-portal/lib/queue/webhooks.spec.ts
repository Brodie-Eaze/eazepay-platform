import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Specs for the webhook-inbox queue wiring (Task #50).
 *
 * Same shape as provisioning.spec.ts — contract tests for the
 * processor's wiring into webhook-processor.processInboxRow.
 * Integration tests against a live Worker live behind an ENV flag
 * (see scripts/test-with-redis.ts when it lands).
 */

const mocks = vi.hoisted(() => ({
  processRow: vi.fn(),
}));

vi.mock('../workers/webhook-processor', () => ({
  processInboxRow: mocks.processRow,
}));

const processRowMock = mocks.processRow;

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

import { processWebhookJob } from './webhooks';
import type { Job } from 'bullmq';

function buildJob(inboxId: string): Job<{ inboxId: string }> {
  return { data: { inboxId } } as unknown as Job<{ inboxId: string }>;
}

describe('processWebhookJob', () => {
  beforeEach(() => {
    processRowMock.mockReset();
  });

  it('delegates to processInboxRow on the happy path', async () => {
    const id = '00000000-0000-4000-8000-000000000020';
    processRowMock.mockResolvedValue(undefined);

    await processWebhookJob(buildJob(id));

    expect(processRowMock).toHaveBeenCalledWith(id);
  });

  it('propagates errors from processInboxRow so BullMQ retries', async () => {
    const id = '00000000-0000-4000-8000-000000000021';
    processRowMock.mockRejectedValueOnce(new Error('handler upstream 502'));

    await expect(processWebhookJob(buildJob(id))).rejects.toThrow('handler upstream 502');
  });

  it('is safe to invoke twice — claim semantics inside processInboxRow', async () => {
    const id = '00000000-0000-4000-8000-000000000022';
    processRowMock.mockResolvedValue(undefined);

    await processWebhookJob(buildJob(id));
    await processWebhookJob(buildJob(id));

    expect(processRowMock).toHaveBeenCalledTimes(2);
    // The first invocation claims pending → processing; the second
    // is a no-op because processInboxRow detects 'done'. That
    // claim contract is covered in webhook-processor.spec.ts.
  });
});
