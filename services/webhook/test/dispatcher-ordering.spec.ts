/**
 * Per-subject in-order delivery for outbound webhooks
 * (fix/webhook-per-subject-ordering).
 *
 * The drain() query must NOT pick a row if an earlier-sequenced
 * sibling for the same subject_id is still {pending, in_flight}.
 * These tests stand up a fake PrismaClient whose $queryRaw evaluates
 * the head-of-line predicate against an in-memory store, so we can
 * assert the JS-equivalent behaviour without spinning up Postgres
 * (the integration test against real PG lives in apps/api e2e).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WebhookDispatcher } from '../src/internal/dispatcher.service.js';

type DeliveryRow = {
  id: string;
  endpoint_id: string;
  merchant_id: string;
  subject_id: string | null;
  sequence: number;
  status: 'pending' | 'in_flight' | 'delivered' | 'failed' | 'dead_letter';
  next_attempt_at: Date | null;
  endpoint_status: 'active' | 'paused' | 'disabled' | 'revoked';
};

function makePrismaWith(rows: DeliveryRow[]) {
  // Simulate the $queryRaw predicate in JS — same shape as the SQL
  // in dispatcher.service.ts drain().
  const queryRaw = vi.fn(async () => {
    const now = Date.now();
    return rows
      .filter((r) => r.status === 'pending')
      .filter((r) => r.endpoint_status === 'active')
      .filter((r) => r.next_attempt_at === null || r.next_attempt_at.getTime() <= now)
      .filter((r) => {
        if (r.subject_id === null) return true;
        return !rows.some(
          (e2) =>
            e2.subject_id === r.subject_id &&
            e2.sequence < r.sequence &&
            (e2.status === 'pending' || e2.status === 'in_flight'),
        );
      })
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, 50)
      .map((r) => ({ id: r.id, endpoint_id: r.endpoint_id, merchant_id: r.merchant_id }));
  });
  return { $queryRaw: queryRaw } as never;
}

function makeQueue() {
  return {
    enqueueDelivery: vi.fn(async () => undefined),
  } as never;
}

function makeDispatcher(prisma: never, queue: never): WebhookDispatcher {
  return new WebhookDispatcher(
    prisma,
    { cronLeader: true, dispatcherEnabled: true },
    { tryAcquireLock: vi.fn() } as never,
    queue,
  );
}

const baseRow = (
  overrides: Partial<DeliveryRow> & Pick<DeliveryRow, 'id' | 'sequence'>,
): DeliveryRow => ({
  endpoint_id: 'ep-1',
  merchant_id: 'merchant-1',
  subject_id: 'app-1',
  status: 'pending',
  next_attempt_at: null,
  endpoint_status: 'active',
  ...overrides,
});

describe('WebhookDispatcher.drain — per-subject ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues 3 same-subject events in sequence order on the first drain (head-of-line)', async () => {
    // Three events for application-1 with sequences 1/2/3, all
    // pending. Only sequence 1 should be eligible — 2 and 3 are
    // gated until 1 reaches a terminal state.
    const rows: DeliveryRow[] = [
      baseRow({ id: 'd-1', sequence: 1 }),
      baseRow({ id: 'd-2', sequence: 2 }),
      baseRow({ id: 'd-3', sequence: 3 }),
    ];
    const queue = makeQueue();
    const d = makeDispatcher(makePrismaWith(rows), queue);

    const r1 = await d.drain();
    expect(r1.enqueued).toBe(1);
    expect(
      (queue as { enqueueDelivery: ReturnType<typeof vi.fn> }).enqueueDelivery,
    ).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: 'd-1' }));

    // Simulate the worker claiming d-1 (pending → in_flight). d-2/d-3
    // are still gated because d-1 is still in_flight.
    rows[0].status = 'in_flight';
    const r2 = await d.drain();
    expect(r2.enqueued).toBe(0);

    // d-1 delivered → d-2 becomes eligible, d-3 still gated.
    rows[0].status = 'delivered';
    const r3 = await d.drain();
    expect(r3.enqueued).toBe(1);
    expect(
      (queue as { enqueueDelivery: ReturnType<typeof vi.fn> }).enqueueDelivery,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ deliveryId: 'd-2' }));

    // d-2 delivered → d-3 unblocks.
    rows[1].status = 'delivered';
    const r4 = await d.drain();
    expect(r4.enqueued).toBe(1);
    expect(
      (queue as { enqueueDelivery: ReturnType<typeof vi.fn> }).enqueueDelivery,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ deliveryId: 'd-3' }));
  });

  it('does not gate different subjects against each other', async () => {
    // Two subjects, interleaved sequences. Each subject's head row
    // should be eligible in the same drain.
    const rows: DeliveryRow[] = [
      baseRow({ id: 'a-1', sequence: 1, subject_id: 'app-1' }),
      baseRow({ id: 'b-1', sequence: 2, subject_id: 'app-2' }),
      baseRow({ id: 'a-2', sequence: 3, subject_id: 'app-1' }),
      baseRow({ id: 'b-2', sequence: 4, subject_id: 'app-2' }),
    ];
    const queue = makeQueue();
    const d = makeDispatcher(makePrismaWith(rows), queue);

    const { enqueued } = await d.drain();
    expect(enqueued).toBe(2);
    const calls = (
      queue as { enqueueDelivery: ReturnType<typeof vi.fn> }
    ).enqueueDelivery.mock.calls.map((c: unknown[]) => (c[0] as { deliveryId: string }).deliveryId);
    expect(calls).toEqual(['a-1', 'b-1']);
  });

  it('does not gate rows with NULL subject_id (independent events)', async () => {
    // Anchor-less events are independent and all eligible on the
    // first drain — they don't gate each other.
    const rows: DeliveryRow[] = [
      baseRow({ id: 'n-1', sequence: 1, subject_id: null }),
      baseRow({ id: 'n-2', sequence: 2, subject_id: null }),
      baseRow({ id: 'n-3', sequence: 3, subject_id: null }),
    ];
    const queue = makeQueue();
    const d = makeDispatcher(makePrismaWith(rows), queue);

    const { enqueued } = await d.drain();
    expect(enqueued).toBe(3);
  });

  it('terminal earlier sibling (failed/dead_letter) unblocks later rows', async () => {
    // A client-fatal 4xx terminally fails d-1 (status='failed'); d-3
    // is dead-lettered. Neither counts as gating — the head-of-line
    // predicate only treats pending/in_flight as blockers. d-2 must
    // therefore become the new head and be eligible on this drain.
    // d-4 is gated by d-2 (still pending), which is the correct
    // ordering behaviour.
    const rows: DeliveryRow[] = [
      baseRow({ id: 'd-1', sequence: 1, status: 'failed' }),
      baseRow({ id: 'd-2', sequence: 2 }),
      baseRow({ id: 'd-3', sequence: 3, status: 'dead_letter' }),
      baseRow({ id: 'd-4', sequence: 4 }),
    ];
    const queue = makeQueue();
    const d = makeDispatcher(makePrismaWith(rows), queue);

    const { enqueued } = await d.drain();
    expect(enqueued).toBe(1);
    const calls = (
      queue as { enqueueDelivery: ReturnType<typeof vi.fn> }
    ).enqueueDelivery.mock.calls.map((c: unknown[]) => (c[0] as { deliveryId: string }).deliveryId);
    expect(calls).toEqual(['d-2']);
  });

  it('respects next_attempt_at — earlier pending row not yet due still gates later rows', async () => {
    // d-1 is pending but its retry backoff hasn't elapsed. d-2 must
    // NOT be enqueued — d-1 still owns head-of-line for app-1.
    // Otherwise a retry of approved could land AFTER funded.
    const rows: DeliveryRow[] = [
      baseRow({
        id: 'd-1',
        sequence: 1,
        next_attempt_at: new Date(Date.now() + 60_000),
      }),
      baseRow({ id: 'd-2', sequence: 2 }),
    ];
    const queue = makeQueue();
    const d = makeDispatcher(makePrismaWith(rows), queue);

    const { enqueued } = await d.drain();
    expect(enqueued).toBe(0);
  });

  it('concurrent drains return the same head row (idempotent at the head-of-line)', async () => {
    // Two replicas drain in parallel. Both see d-1 as the head; the
    // worker's `updateMany where: status=pending` claim transition
    // ensures only one actually delivers, but at the SELECT layer the
    // predicate must be stable across invocations.
    const rows: DeliveryRow[] = [
      baseRow({ id: 'd-1', sequence: 1 }),
      baseRow({ id: 'd-2', sequence: 2 }),
    ];
    const prisma = makePrismaWith(rows);
    const q1 = makeQueue();
    const q2 = makeQueue();
    const d1 = makeDispatcher(prisma, q1);
    const d2 = makeDispatcher(prisma, q2);

    const [r1, r2] = await Promise.all([d1.drain(), d2.drain()]);
    expect(r1.enqueued).toBe(1);
    expect(r2.enqueued).toBe(1);
    const c1 = (q1 as { enqueueDelivery: ReturnType<typeof vi.fn> }).enqueueDelivery.mock
      .calls[0][0] as { deliveryId: string };
    const c2 = (q2 as { enqueueDelivery: ReturnType<typeof vi.fn> }).enqueueDelivery.mock
      .calls[0][0] as { deliveryId: string };
    expect(c1.deliveryId).toBe('d-1');
    expect(c2.deliveryId).toBe('d-1');
    // The claim transition in WebhookWorker.deliver() (updateMany
    // where status=pending) is what dedupes the two enqueues — that
    // path is covered by WebhookWorker tests, not here.
  });
});
