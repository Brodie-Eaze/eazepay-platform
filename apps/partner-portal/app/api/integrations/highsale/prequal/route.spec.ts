import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Post-P0 (FCRA-persist): the route now fails-closed when `hasDb()` is
 * false and routes all receipt I/O through `lib/db/consent-receipts`.
 * Tests mock both layers so the in-memory verifier semantics under
 * test stay the same while the route's DB precondition is satisfied.
 */
type StoredRow = {
  id: string;
  applicationId: string;
  sessionId: string | null;
  partnerId: string | null;
  brand: string;
  disclosureVersion: string;
  capturedAt: Date;
  capturedIp: string;
  capturedUserAgent: string | null;
  signatureHash: string;
  rawText: string;
  createdAt: Date | null;
};

const receiptStore = new Map<string, StoredRow>();

vi.mock('../../../../../lib/db', () => ({
  hasDb: () => true,
  getDb: () => ({
    insert: () => ({ values: async () => undefined }),
  }),
  schema: { auditLog: {} },
}));

vi.mock('../../../../../lib/db/consent-receipts', () => ({
  storeReceipt: async (input: StoredRow & { capturedAt?: Date; createdAt?: Date }) => {
    const row: StoredRow = {
      id: input.id,
      applicationId: input.applicationId,
      sessionId: input.sessionId ?? null,
      partnerId: input.partnerId ?? null,
      brand: input.brand,
      disclosureVersion: input.disclosureVersion,
      capturedAt: input.capturedAt ?? new Date(),
      capturedIp: input.capturedIp,
      capturedUserAgent: input.capturedUserAgent ?? null,
      signatureHash: input.signatureHash,
      rawText: input.rawText,
      createdAt: input.createdAt ?? new Date(),
    };
    receiptStore.set(row.id, row);
    return row;
  },
  getReceiptById: async (id: string) => receiptStore.get(id) ?? null,
  getReceiptByApplicationId: async (applicationId: string) =>
    [...receiptStore.values()].filter((r) => r.applicationId === applicationId),
  getLatestReceiptForSession: async (applicationId: string, sessionId: string) => {
    const matches = [...receiptStore.values()].filter(
      (r) => r.applicationId === applicationId && r.sessionId === sessionId,
    );
    return matches[matches.length - 1] ?? null;
  },
}));

import { POST } from './route';
import {
  SOFT_PULL_CONSENT_TEXT,
  SOFT_PULL_DISCLOSURE_VERSION,
  FCRA_CONSENT_MAX_AGE_MS,
  storeConsentReceipt,
  __resetConsentReceiptStoreForTests,
  type ConsentReceipt,
} from '../../../../../lib/consumer-consent';
import { signDemoPreset, _resetDemoCookieKeyCache } from '../../../../../lib/demo-cookie';

/**
 * SEC-006 / Task #45 — FCRA consent verification at the prequal route.
 *
 * The route is gated by Builder B's `requirePartnerSession` so each
 * case mints a signed `eazepay_demo=master` cookie to satisfy the
 * partner-session check. The FCRA verifier is the new layer under test;
 * every adversarial path (missing receipt, mismatched applicationId,
 * stale receipt, mismatched disclosure version) returns 412 with a
 * Problem Details body keyed on `fcra_consent_missing`.
 *
 * The synthetic store is reset between cases so the per-application
 * eviction cap doesn't leak state across tests.
 */

const APP_ID = 'app_medpay_test_001';
const SESSION_ID = 'sess_test_001';

interface PrequalBodyOverrides {
  consentReceiptId?: string;
  applicationId?: string;
  subAccountId?: string;
  requestId?: string;
}

function buildBody(overrides: PrequalBodyOverrides = {}): Record<string, unknown> {
  return {
    subAccountId: overrides.subAccountId ?? 'hs_test_sub',
    applicationId: overrides.applicationId ?? APP_ID,
    consentReceiptId: overrides.consentReceiptId ?? 'missing',
    consumer: {
      firstName: 'Avery',
      lastName: 'Patient',
      email: 'avery@example.com',
      phone: '5555550100',
      ssnLast4: '1234',
      dob: '1990-01-01',
      address: { street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701' },
      annualIncomeCents: 9_000_000,
      employmentType: 'w2',
    },
    requestedAmountCents: 1_200_000,
    requestId: overrides.requestId ?? 'req_test_00000001',
  };
}

async function buildRequest(body: Record<string, unknown>): Promise<NextRequest> {
  // Signed demo cookie satisfies the partner-session guard. `master`
  // resolves to operator scope, which is the simplest path through
  // `requirePartnerSession` — full coverage of the partner-session
  // matrix lives in middleware/session specs, not here.
  const signed = await signDemoPreset('master', 60);
  return new NextRequest('http://localhost/api/integrations/highsale/prequal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `eazepay_demo=${signed}`,
    },
    body: JSON.stringify(body),
  });
}

async function freshReceipt(): Promise<ConsentReceipt> {
  return storeConsentReceipt({
    applicationId: APP_ID,
    sessionId: SESSION_ID,
    disclosureVersion: SOFT_PULL_DISCLOSURE_VERSION,
    consentText: SOFT_PULL_CONSENT_TEXT,
    ip: '127.0.0.1',
    userAgent: 'vitest',
  });
}

describe('POST /api/integrations/highsale/prequal — FCRA consent gate', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    __resetConsentReceiptStoreForTests();
    receiptStore.clear();
  });

  it('200 — valid consent receipt + matching applicationId runs the soft pull', async () => {
    const receipt = await freshReceipt();
    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: receipt.id, applicationId: APP_ID })),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; pullId: string; tier: string };
    expect(json.ok).toBe(true);
    expect(json.pullId).toMatch(/^pull_/);
    expect(['A', 'B', 'C', 'D']).toContain(json.tier);
  });

  it('400 — missing consentReceiptId triggers Zod validation error', async () => {
    const body = buildBody();
    delete (body as Record<string, unknown>).consentReceiptId;
    const res = await POST(await buildRequest(body));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('invalid_prequal_payload');
  });

  it('412 not_found — consentReceiptId not in the store', async () => {
    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: 'rcpt_does_not_exist' })),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string; status: number };
    expect(json.status).toBe(412);
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('not_found');
  });

  it('412 wrong_application — receipt exists but applicationId mismatches', async () => {
    const receipt = await freshReceipt();
    const res = await POST(
      await buildRequest(
        buildBody({ consentReceiptId: receipt.id, applicationId: 'app_someone_elses' }),
      ),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string };
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('wrong_application');
  });

  it('412 expired — consent older than the 30-day freshness window', async () => {
    // Capture a receipt, then back-date its capturedAt past the window
    // directly in the mocked row store (production rows come from
    // Postgres and are immutable; this mutation only simulates a >30d
    // old row coming back from the table).
    const receipt = await freshReceipt();
    const staleMs = Date.now() - (FCRA_CONSENT_MAX_AGE_MS + 60_000);
    const row = receiptStore.get(receipt.id);
    if (!row) throw new Error('test setup: receipt not in mocked store');
    row.capturedAt = new Date(staleMs);

    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: receipt.id, applicationId: APP_ID })),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string };
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('expired');
  });

  it('412 wrong_disclosure_version — receipt pinned to an older disclosure', async () => {
    const receipt = await storeConsentReceipt({
      applicationId: APP_ID,
      sessionId: SESSION_ID,
      // Anything other than the current constant triggers the check.
      disclosureVersion: '2025-01-01.v0',
      consentText: 'older verbatim text',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: receipt.id, applicationId: APP_ID })),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string };
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('wrong_disclosure_version');
  });
});
