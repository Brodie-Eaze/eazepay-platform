import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../src/notification.service.js';
import type { UserId } from '@eazepay/shared-types';

/**
 * Characterisation tests for NotificationService.notify.
 *
 * The service is wired with three injected dependencies: PrismaClient,
 * a list of NotificationChannelAdapter, and (transitively) the template
 * registry. Tests stub Prisma and adapter list to assert the dispatch
 * pipeline: persist queued → resolve `to` → adapter.send → update row.
 */

interface NotificationRow {
  id: string;
  userId: string;
  channel: string;
  templateKey: string;
  payload: object;
  status: string;
  providerRef?: string | null;
  failureReason?: string | null;
  sentAt?: Date | null;
  subjectType?: string | null;
  subjectId?: string | null;
}

function makeFakePrisma(user: { email: string | null; phoneE164: string | null } | null) {
  const rows: NotificationRow[] = [];
  let seq = 0;
  return {
    rows,
    user: {
      findUnique: vi.fn(async (_args: unknown) => user),
    },
    notification: {
      create: vi.fn(async ({ data, select }: { data: NotificationRow; select?: { id: boolean } }) => {
        seq += 1;
        const row: NotificationRow = { ...data, id: `n-${seq}` };
        rows.push(row);
        if (select?.id) return { id: row.id };
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<NotificationRow> }) => {
        const r = rows.find((x) => x.id === where.id);
        if (r) Object.assign(r, data);
        return r;
      }),
    },
  };
}

function makeAdapter(channel: string) {
  const send = vi.fn(async ({ notificationId }: { notificationId: string }) => ({
    status: 'sent' as const,
    providerRef: `prov-${notificationId}`,
  }));
  return {
    name: `fake-${channel}`,
    channel: channel as never,
    send,
  };
}

describe('NotificationService.notify — dispatch pipeline', () => {
  it('returns silently for unknown templateKey (logs warn, no DB write)', async () => {
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: '+15551234567' });
    const email = makeAdapter('email');
    const svc = new NotificationService(prisma as never, [email]);
    await svc.notify({ userId: 'u1', templateKey: 'totally.unknown' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('email route: resolves user.email and calls the email adapter', async () => {
    const prisma = makeFakePrisma({ email: 'consumer@example.com', phoneE164: null });
    const email = makeAdapter('email');
    const inApp = makeAdapter('in_app');
    const svc = new NotificationService(prisma as never, [email, inApp]);

    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      payload: {},
      subjectType: 'Application',
      subjectId: 'app-1',
    });

    expect(email.send).toHaveBeenCalledOnce();
    const callArg = email.send.mock.calls[0]![0]!;
    expect(callArg.to).toBe('consumer@example.com');
    expect(callArg.title).toBe('Decision on your EazePay application');
    expect(callArg.body).toContain('Adverse Action Notice');
    // status flow: queued -> sent
    const emailRow = prisma.rows.find((r) => r.channel === 'email');
    expect(emailRow?.status).toBe('sent');
    expect(emailRow?.providerRef).toContain('prov-');
    expect(emailRow?.sentAt).toBeInstanceOf(Date);
  });

  it('sms route: resolves user.phoneE164 (NOT email) for the sms adapter', async () => {
    const prisma = makeFakePrisma({ email: 'x@y.com', phoneE164: '+15558675309' });
    const sms = makeAdapter('sms');
    const svc = new NotificationService(prisma as never, [sms]);

    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'payment.repayment.failed',
      payload: { amountCents: 5000 },
      channels: ['sms'],
    });

    expect(sms.send).toHaveBeenCalledOnce();
    expect(sms.send.mock.calls[0]![0]!.to).toBe('+15558675309');
  });

  it('push route: resolves phoneE164 (MVP shim — co-opts phone as device-token surrogate)', async () => {
    const prisma = makeFakePrisma({ email: null, phoneE164: '+15550001111' });
    const push = makeAdapter('push');
    const svc = new NotificationService(prisma as never, [push]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.funded',
      payload: { principalCents: 100000 },
      channels: ['push'],
    });
    expect(push.send.mock.calls[0]![0]!.to).toBe('+15550001111');
  });

  it('suppresses + persists status="suppressed" when channel has no destination (email missing)', async () => {
    const prisma = makeFakePrisma({ email: null, phoneE164: null });
    const email = makeAdapter('email');
    const svc = new NotificationService(prisma as never, [email]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      channels: ['email'],
    });
    expect(email.send).not.toHaveBeenCalled();
    const row = prisma.rows[0]!;
    expect(row.status).toBe('suppressed');
    expect(row.failureReason).toBe('no_destination');
  });

  it('in_app delivery proceeds even when user has no email/phone (in_app skips destination check)', async () => {
    const prisma = makeFakePrisma({ email: null, phoneE164: null });
    const inApp = makeAdapter('in_app');
    const svc = new NotificationService(prisma as never, [inApp]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      channels: ['in_app'],
    });
    expect(inApp.send).toHaveBeenCalledOnce();
    expect(inApp.send.mock.calls[0]![0]!.to).toBe('');
  });

  it('persists status="failed" with failureReason="adapter_exception" when adapter throws', async () => {
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: null });
    const email = {
      name: 'broken',
      channel: 'email' as never,
      send: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    const svc = new NotificationService(prisma as never, [email]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      channels: ['email'],
    });
    const row = prisma.rows[0]!;
    expect(row.status).toBe('failed');
    expect(row.failureReason).toBe('adapter_exception');
  });

  it('skips channels with no registered adapter (no row written, no throw)', async () => {
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: '+15550000000' });
    // Only in_app adapter wired; template wants sms+email+push too.
    const inApp = makeAdapter('in_app');
    const svc = new NotificationService(prisma as never, [inApp]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'payment.repayment.failed',
      payload: { amountCents: 100 },
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]!.channel).toBe('in_app');
  });

  it('honours per-call channels override (does NOT also dispatch template defaults)', async () => {
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: null });
    const email = makeAdapter('email');
    const inApp = makeAdapter('in_app');
    const svc = new NotificationService(prisma as never, [email, inApp]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.funded', // template defaults: push, email, in_app
      payload: { principalCents: 1000 },
      channels: ['email'], // override
    });
    expect(email.send).toHaveBeenCalledOnce();
    expect(inApp.send).not.toHaveBeenCalled();
  });

  it('idempotency surface: redelivering the same outbox row writes a NEW Notification row each call (no de-dup at service layer)', async () => {
    // Characterisation: notify() does NOT itself dedupe — the outbox
    // pattern relies on the outbox dispatcher's once-only semantics
    // (subjectType+subjectId+templateKey unique key at the DB layer).
    // This pins the contract: re-invoking notify with identical inputs
    // produces a second row. If a future change adds service-level
    // dedup, this test must flip to assert the new behaviour.
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: null });
    const email = makeAdapter('email');
    const svc = new NotificationService(prisma as never, [email]);
    const input = {
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      channels: ['email' as const],
      subjectType: 'Application',
      subjectId: 'app-1',
    };
    await svc.notify(input);
    await svc.notify(input);
    expect(prisma.rows.filter((r) => r.channel === 'email')).toHaveLength(2);
    expect(email.send).toHaveBeenCalledTimes(2);
  });

  it('returns immediately when template has zero deliverable channels', async () => {
    const prisma = makeFakePrisma({ email: 'a@b.com', phoneE164: null });
    const email = makeAdapter('email');
    const svc = new NotificationService(prisma as never, [email]);
    await svc.notify({
      userId: 'u1' as UserId,
      templateKey: 'application.declined',
      channels: [], // explicit empty
    });
    expect(prisma.rows).toHaveLength(0);
  });
});
