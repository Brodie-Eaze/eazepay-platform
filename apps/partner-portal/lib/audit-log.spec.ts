import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ISO-03 fail-loud test needs to drive the DB-write FAILURE branch:
// `hasDb()` true + an insert that throws. Mock the db module so the
// helper takes the persist path and the insert rejects.
const dbState = { hasDb: false, insertThrows: false };
vi.mock('./db', () => ({
  hasDb: () => dbState.hasDb,
  getDb: () => ({
    insert: () => ({
      values: async () => {
        if (dbState.insertThrows) {
          // Mirror a Postgres RLS WITH CHECK rejection (the ISO-02 case).
          throw new Error('new row violates row-level security policy for table "audit_log"');
        }
        return undefined;
      },
    }),
  }),
  schema: { auditLog: {} },
}));

import { writeAuditLog } from './audit-log';

/**
 * audit-log helper — SOC2 CC8.1 evidence pipeline.
 *
 * The helper is best-effort by design: it MUST NOT throw out of an
 * admin route, because doing so would mask a successful mutation
 * behind a 500 to the caller. These tests pin that contract + verify
 * the dev no-db path degrades cleanly.
 */

function mockReq(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return {
    headers: h,
    ip: '127.0.0.1',
  } as unknown as NextRequest;
}

describe('writeAuditLog', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    // Default: behave as if no DB (the existing dev-fallback tests).
    dbState.hasDb = false;
    dbState.insertThrows = false;
    // eslint-disable-next-line no-console
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // eslint-disable-next-line no-console
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no-ops with an info breadcrumb when DATABASE_URL is unset', async () => {
    await writeAuditLog({
      actor: 'demo:master',
      action: 'team.member.added',
      targetType: 'team_member',
      targetId: null,
      outcome: 'success',
      payload: { email: 'invitee@example.com', role: 'admin' },
      req: mockReq(),
    });
    expect(infoSpy).toHaveBeenCalled();
    const arg = infoSpy.mock.calls[0]?.[0];
    expect(typeof arg).toBe('string');
    const parsed = JSON.parse(arg as string);
    expect(parsed.event).toBe('audit_log.skip_no_db');
    expect(parsed.action).toBe('team.member.added');
    expect(parsed.outcome).toBe('success');
  });

  it('never throws even for adversarial input', async () => {
    await expect(
      writeAuditLog({
        actor: '',
        action: '',
        targetType: '',
        outcome: 'failed',
        payload: { huge: 'x'.repeat(5000) },
      }),
    ).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('handles missing req without crashing', async () => {
    await expect(
      writeAuditLog({
        actor: 'system',
        action: 'migration.queued',
        targetType: 'customer_migration',
        targetId: 'mig_123',
        outcome: 'success',
      }),
    ).resolves.toBeUndefined();
  });

  // -------- ISO-03: fail-loud on a dropped audit row --------

  it('ISO-03: a rejected audit INSERT is logged LOUD (critical, control-tagged) but does NOT throw', async () => {
    dbState.hasDb = true;
    dbState.insertThrows = true;

    // Still must not throw — audit is a side-channel; the mutation it
    // described already happened.
    await expect(
      writeAuditLog({
        actor: 'consumer:prequal',
        action: 'credit_pull.soft',
        targetType: 'application',
        targetId: 'app_123',
        outcome: 'success',
      }),
    ).resolves.toBeUndefined();

    // But it MUST be unmistakable in the logs: dedicated event name,
    // critical severity, alert flag, and a control tag.
    expect(errorSpy).toHaveBeenCalled();
    const parsed = JSON.parse(errorSpy.mock.calls[0]?.[0] as string);
    expect(parsed.event).toBe('audit_log.write_dropped');
    expect(parsed.severity).toBe('critical');
    expect(parsed.alert).toBe(true);
    expect(parsed.control).toBe('SOC2-CC8.1');
    expect(parsed.compliance_gap).toBe('audit_write_dropped');
    expect(parsed.action).toBe('credit_pull.soft');
  });
});
