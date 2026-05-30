import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * SEC-FCRA-02 — FCRA permissible-purpose gate on the decision-engine route.
 *
 * `evaluateDecision` runs the credit scorer over the consumer's bureau
 * profile, which is a use of a consumer report under FCRA §604
 * [15 U.S.C. § 1681b]. The prequal route already gates the upstream soft
 * pull behind `verifyFCRAConsent`; this spec asserts the SAME gate now
 * fronts the scoring step:
 *
 *   (a) valid consent receipt (exists, matches applicationId, current
 *       disclosure version, fresh) → route proceeds and `evaluateDecision`
 *       is invoked exactly once.
 *   (b) missing/invalid consent → 412 fcra_consent_missing AND
 *       `evaluateDecision` is NEVER invoked (no scoring, no bureau pull,
 *       no decision row written). Fail-closed.
 *
 * Mocking mirrors the prequal route spec: `lib/db` reports a live DB so
 * the verifier reads the (mocked) `consent_receipts` store, and the
 * receipt I/O layer is an in-memory map. `lib/decision-engine` is mocked
 * to a spy so the invoked/not-invoked assertion is exact and the real
 * engine's persistence path never runs.
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

vi.mock('@/lib/db', () => ({
  hasDb: () => true,
  // `assertResourceOwnership` short-circuits on the operator override
  // preset used below, so getDb is never reached on these paths; provide
  // a benign stub so the import resolves under the vitest runner.
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  }),
  schema: {},
}));

vi.mock('@/lib/db/consent-receipts', () => ({
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

// The unit under test for "did scoring run?" — a spy stands in for the
// real engine so the not-invoked assertion is exact and no DB write,
// Trutopia call, or DLQ side effect can occur on the 412 path.
const evaluateDecisionMock = vi.fn(async () => ({
  decisionId: 'dec_test_0001',
  engine: 'internal' as const,
  engineVersion: 'internal_v1',
  engineFallback: false,
  latencyMs: 1,
  decisionMode: 'normal' as const,
  status: 'ok' as const,
  detail: null,
  rankedLenders: [],
  eligibleCount: 0,
  excludedCount: 0,
  topPropensityScore: null,
}));

vi.mock('@/lib/decision-engine', () => ({
  evaluateDecision: (...args: unknown[]) => evaluateDecisionMock(...(args as [])),
}));

import { POST } from './route';
import {
  SOFT_PULL_CONSENT_TEXT,
  SOFT_PULL_DISCLOSURE_VERSION,
  storeConsentReceipt,
  __resetConsentReceiptStoreForTests,
  type ConsentReceipt,
} from '@/lib/consumer-consent-server';
import { signDemoPreset, _resetDemoCookieKeyCache } from '@/lib/demo-cookie';

// applicationId must satisfy `z.string().uuid()` on this route.
const APP_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = 'sess_decision_001';

interface BodyOverrides {
  consentReceiptId?: string;
  applicationId?: string;
}

function buildBody(overrides: BodyOverrides = {}): Record<string, unknown> {
  return {
    applicationId: overrides.applicationId ?? APP_ID,
    consentReceiptId: overrides.consentReceiptId ?? 'missing',
    prequal: {
      tier: 'A',
      ficoBand: 760,
      dti: 0.25,
      openTradelines: 6,
      amountCents: 1_200_000,
      annualIncomeCents: 9_000_000,
      state: 'TX',
      brand: 'medpay',
    },
  };
}

async function buildRequest(body: Record<string, unknown>): Promise<NextRequest> {
  // `master` operator preset satisfies requirePartnerSession and makes
  // assertResourceOwnership a no-op (isAdminOverride) — same shortcut the
  // prequal spec relies on.
  const signed = await signDemoPreset('master', 60);
  return new NextRequest('http://localhost/api/v1/decision-engine', {
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

describe('POST /api/v1/decision-engine — FCRA consent gate', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    __resetConsentReceiptStoreForTests();
    receiptStore.clear();
    evaluateDecisionMock.mockClear();
  });

  it('(a) valid consent receipt + matching applicationId → scoring proceeds', async () => {
    const receipt = await freshReceipt();
    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: receipt.id, applicationId: APP_ID })),
    );
    expect(res.status).toBe(200);
    // The gate let the request through to the engine exactly once.
    expect(evaluateDecisionMock).toHaveBeenCalledTimes(1);
    expect(evaluateDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APP_ID }),
    );
  });

  it('(b) no consent receipt on file → 412 and NO scoring invoked', async () => {
    const res = await POST(
      await buildRequest(buildBody({ consentReceiptId: 'rcpt_does_not_exist' })),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string; status: number };
    expect(json.status).toBe(412);
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('not_found');
    // Fail-closed: the scorer/bureau engine must never have run.
    expect(evaluateDecisionMock).not.toHaveBeenCalled();
  });

  it('(b2) receipt exists but applicationId mismatches → 412 wrong_application, NO scoring', async () => {
    const receipt = await freshReceipt();
    const res = await POST(
      await buildRequest(
        // A different but still-valid UUID so we exercise the verifier's
        // cross-application replay guard, not Zod.
        buildBody({
          consentReceiptId: receipt.id,
          applicationId: '22222222-2222-4222-8222-222222222222',
        }),
      ),
    );
    expect(res.status).toBe(412);
    const json = (await res.json()) as { code: string; detail: string };
    expect(json.code).toBe('fcra_consent_missing');
    expect(json.detail).toBe('wrong_application');
    expect(evaluateDecisionMock).not.toHaveBeenCalled();
  });

  it('400 — missing consentReceiptId is a Zod validation error (never reaches scoring)', async () => {
    const body = buildBody();
    delete (body as Record<string, unknown>).consentReceiptId;
    const res = await POST(await buildRequest(body));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('invalid_decision_payload');
    expect(evaluateDecisionMock).not.toHaveBeenCalled();
  });
});
