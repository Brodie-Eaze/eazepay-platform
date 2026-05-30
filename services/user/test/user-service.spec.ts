// Characterization tests for UserService — KYC initiation, masking,
// step-up gating, and audit-row emission. The Prisma layer is faked
// in-memory so we exercise the real branches without a DB.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserService } from '../src/user.service.js';
import { MockKycAdapter } from '../src/adapters/mock-kyc.adapter.js';
import type { KycProvider, KycStatusResult } from '../src/ports/kyc-provider.port.js';
import { makeUserPrisma, makeVault, samplePii } from './_helpers.js';

const seedUser = (overrides: Partial<{ id: string; isAdmin: boolean; status: string }> = {}) => ({
  id: overrides.id ?? 'user-1',
  email: 'alex@example.com',
  phoneE164: '+15125550000',
  status: overrides.status ?? 'active',
  isAdmin: overrides.isAdmin ?? false,
});

describe('UserService.startKyc — adapter return paths via MockKycAdapter', () => {
  it('approved path: stores kycStatus=approved, kycCompletedAt set, emits audit row', async () => {
    const { client, profiles, audit } = makeUserPrisma({ users: [seedUser()] });
    const vault = makeVault();
    const svc = new UserService(client, vault, new MockKycAdapter());

    // Profile must exist before KYC. updateProfile seals via vault.
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ legalName: { first: 'Alex', last: 'Doe' } }),
    );
    const r = await svc.startKyc('user-1' as any, '203.0.113.1', 'jest-ua');
    expect(r.outcome).toBe('approved');
    expect(r.providerRef).toMatch(/^[0-9a-f-]{36}$/);

    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.kycStatus).toBe('approved');
    expect(p.kycCompletedAt).toBeInstanceOf(Date);
    expect(p.pepStatus).toBe('cleared');
    expect(p.sanctionsCheckedAt).toBeInstanceOf(Date);
    expect(p.kycProviderRef).toBe(r.providerRef);
    expect(audit.map((a) => a.action)).toContain('user.kyc.initiated');
    const kycAudit = audit.find((a) => a.action === 'user.kyc.initiated')!;
    expect((kycAudit.after as any).ipAddress).toBe('203.0.113.1');
    expect((kycAudit.after as any).userAgent).toBe('jest-ua');
  });

  it('AML-03: a sanctions MATCH persists sanctionsStatus="match" (not "cleared") and getMe reports it', async () => {
    // Regression guard for the real bug: the verdict used to be inferred
    // from `sanctionsCheckedAt`, which was set for BOTH cleared and match,
    // so a genuine OFAC hit was read back as "cleared". The provider here
    // approves identity but flags a sanctions match — the persisted verdict
    // MUST be 'match', and getMe MUST surface it.
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const matchAdapter: KycProvider = {
      initiate: vi.fn(async () => ({ providerRef: 'ref-match', outcome: 'approved' as const })),
      status: vi.fn(
        async (): Promise<KycStatusResult> => ({
          outcome: 'approved',
          reasonCodes: ['ofac_potential_match'],
          pep: 'cleared',
          sanctions: 'match',
        }),
      ),
    };
    const svc = new UserService(client, makeVault(), matchAdapter);
    await svc.updateProfile('user-1' as any, samplePii());
    await svc.startKyc('user-1' as any);

    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.sanctionsStatus).toBe('match');
    expect(p.sanctionsStatus).not.toBe('cleared');

    const me = await svc.getMe('user-1' as any);
    expect(me.kyc.sanctions).toBe('match');
  });

  it('AML-03: a genuine clear persists sanctionsStatus="cleared" (happy path still works)', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    await svc.startKyc('user-1' as any);
    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.sanctionsStatus).toBe('cleared');
    const me = await svc.getMe('user-1' as any);
    expect(me.kyc.sanctions).toBe('cleared');
  });

  it('manual_review path: legalName.last starts with "X" → kycStatus=manual_review, no completedAt', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ legalName: { first: 'Xen', last: 'Xander' } }),
    );
    const r = await svc.startKyc('user-1' as any);
    expect(r.outcome).toBe('manual_review');
    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.kycStatus).toBe('manual_review');
    expect(p.kycCompletedAt).toBeNull();
  });

  it('rejected path: legalName.last starts with "XR" → kycStatus=rejected', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ legalName: { first: 'Xen', last: 'Xray' } }),
    );
    const r = await svc.startKyc('user-1' as any);
    expect(r.outcome).toBe('rejected');
    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.kycStatus).toBe('rejected');
  });

  it('pending path: outcome=pending (non-terminal) maps to kycStatus=in_progress', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const pendingAdapter: KycProvider = {
      initiate: vi.fn(async () => ({ providerRef: 'ref-pending', outcome: 'pending' as const })),
      status: vi.fn(
        async (): Promise<KycStatusResult> => ({
          outcome: 'pending',
          reasonCodes: [],
          pep: 'unknown',
          sanctions: 'unknown',
        }),
      ),
    };
    const svc = new UserService(client, makeVault(), pendingAdapter);
    await svc.updateProfile('user-1' as any, samplePii());
    const r = await svc.startKyc('user-1' as any);
    expect(r.outcome).toBe('pending');
    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.kycStatus).toBe('in_progress');
    expect(p.pepStatus).toBe('unknown');
    expect(p.sanctionsCheckedAt).toBeNull();
  });

  it('expired/unknown ref path: MockKycAdapter.status() returns "expired" when ref not tracked → kycStatus=in_progress', async () => {
    // Build an adapter that returns a known ref on initiate but loses
    // it on status() — characterizes the "expired" fallback in
    // MockKycAdapter and how UserService maps it (anything non-terminal → in_progress).
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const adapter = new MockKycAdapter();
    const origStatus = adapter.status.bind(adapter);
    vi.spyOn(adapter, 'status').mockImplementation(async () => origStatus('never-seen-ref'));
    const svc = new UserService(client, makeVault(), adapter);
    await svc.updateProfile('user-1' as any, samplePii());
    const r = await svc.startKyc('user-1' as any);
    expect(r.outcome).toBe('expired');
    const p = profiles.find((x) => x.userId === 'user-1')!;
    expect(p.kycStatus).toBe('in_progress');
  });

  it('profile_required: starting KYC without first PATCHing profile throws BadRequest', async () => {
    const { client } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await expect(svc.startKyc('user-1' as any)).rejects.toMatchObject({
      problem: { status: 400, code: 'profile_required' },
    });
  });

  it('already-approved short-circuit: returns approved + existing providerRef without re-calling provider', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const adapter = new MockKycAdapter();
    const initSpy = vi.spyOn(adapter, 'initiate');
    const svc = new UserService(client, makeVault(), adapter);
    await svc.updateProfile('user-1' as any, samplePii());
    await svc.startKyc('user-1' as any); // first run: approved
    // Mutate profile state directly to simulate prior approval with a known ref
    const p = profiles.find((x) => x.userId === 'user-1')!;
    p.kycStatus = 'approved';
    p.kycProviderRef = 'prior-ref-abc';
    initSpy.mockClear();
    const r = await svc.startKyc('user-1' as any);
    expect(r).toEqual({ outcome: 'approved', providerRef: 'prior-ref-abc' });
    expect(initSpy).not.toHaveBeenCalled();
  });
});

describe('UserService.updateProfile — KYC state machine + audit', () => {
  it('create branch: first PATCH writes a `user.profile.created` audit row, kycStatus stays not_started', async () => {
    const { client, profiles, audit } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    expect(profiles[0].kycStatus).toBe('not_started');
    expect(audit.map((a) => a.action)).toEqual(['user.profile.created']);
  });

  it('SEC-023 re-KYC: editing PII AFTER approval flips kycStatus back to not_started and clears completedAt', async () => {
    const { client, profiles, audit } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    await svc.startKyc('user-1' as any); // approved
    expect(profiles[0].kycStatus).toBe('approved');
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ address: { line1: '999 New', city: 'Houston', state: 'TX', zip: '77002' } }),
    );
    expect(profiles[0].kycStatus).toBe('not_started');
    expect(profiles[0].kycCompletedAt).toBeNull();
    const updates = audit.filter((a) => a.action === 'user.profile.updated');
    expect(updates.length).toBe(1);
    expect((updates[0].after as any).requiresRekyc).toBe(true);
  });

  it('rejected state allows PATCH without re-KYC flag (rejected & not_started are both editable)', async () => {
    const { client, profiles } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ legalName: { first: 'Xen', last: 'Xray' } }),
    );
    await svc.startKyc('user-1' as any); // rejected via mock
    expect(profiles[0].kycStatus).toBe('rejected');
    await svc.updateProfile(
      'user-1' as any,
      samplePii({ legalName: { first: 'Alex', last: 'Doe' } }),
    );
    // rejected→update keeps the existing status (no re-kyc flag) per
    // the legacy if-condition: `existing.kycStatus !== 'not_started' && !== 'rejected'`
    expect(profiles[0].kycStatus).toBe('rejected');
  });
});

describe('UserService.getMe — masking + step-up gate (SEC-023)', () => {
  it('returns absent profile when user has no ConsumerProfile row', async () => {
    const { client } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    const me = await svc.getMe('user-1' as any);
    expect(me.profileVisibility).toBe('absent');
    expect(me.profile).toBeNull();
    expect(me.kyc.status).toBe('not_started');
    expect(me.kyc.pep).toBe('unknown');
  });

  it('masked default: legalName.last → "D.", DOB year only, address.line1 → "***", zip → first 3 digits', async () => {
    const { client } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    const me = await svc.getMe('user-1' as any); // default masked
    expect(me.profileVisibility).toBe('masked');
    const p = me.profile as any;
    expect(p.legalName).toEqual({ first: 'Alex', last: 'D.' });
    expect(p.dateOfBirth).toBe('1990-**-**');
    expect(p.ssnLast4).toBe('***');
    expect(p.address.line1).toBe('***');
    expect(p.address.line2).toBe('***');
    expect(p.address.city).toBe('Austin');
    expect(p.address.state).toBe('TX');
    expect(p.address.zip).toBe('787');
  });

  it('reveal=full FAILS CLOSED with code=step_up_required (step-up wiring not yet plumbed)', async () => {
    const { client } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    await expect(svc.getMe('user-1' as any, { reveal: 'full' })).rejects.toMatchObject({
      problem: { status: 403, code: 'step_up_required' },
    });
  });

  it('ssnLast4 mask: when seeded PII omits ssnLast4, masked.ssnLast4 is null (not "***")', async () => {
    const { client } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii({ ssnLast4: undefined }));
    const me = await svc.getMe('user-1' as any);
    expect((me.profile as any).ssnLast4).toBeNull();
  });

  it('user_not_found: returns 404 when no user row exists', async () => {
    const { client } = makeUserPrisma();
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await expect(svc.getMe('ghost' as any)).rejects.toMatchObject({
      problem: { status: 404, code: 'user_not_found' },
    });
  });
});

describe('UserService — audit-log: every PII-touching action emits an outbox row (JIT audit oracle)', () => {
  it('a full lifecycle (create, kyc, edit) produces exactly create / kyc.initiated / updated rows in order', async () => {
    const { client, audit } = makeUserPrisma({ users: [seedUser()] });
    const svc = new UserService(client, makeVault(), new MockKycAdapter());
    await svc.updateProfile('user-1' as any, samplePii());
    await svc.startKyc('user-1' as any);
    await svc.updateProfile('user-1' as any, samplePii({ ssnLast4: '9999' }));
    expect(audit.map((a) => a.action)).toEqual([
      'user.profile.created',
      'user.kyc.initiated',
      'user.profile.updated',
    ]);
    for (const row of audit) {
      expect(row.actorType).toBe('user');
      expect(row.actorId).toBe('user-1');
      expect(row.targetId).toBe('user-1');
    }
  });

  it.todo(
    'JIT PII unmask: reveal=full with valid step-up records an audit_log row (pending SEC-023 step-up wiring)',
  );
});

beforeEach(() => {
  vi.restoreAllMocks();
});
