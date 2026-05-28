import 'server-only';

/* This file was split out of lib/consumer-consent.ts so the client
 * bundle for app/apply/<brand>/page.tsx does not transitively pull
 * in the Postgres driver. Browser-safe constants + helpers stay in
 * lib/consumer-consent.ts; everything that touches the DB / dynamic
 * imports './db' lives here.  */

import {
  SOFT_PULL_DISCLOSURE_VERSION,
  SOFT_PULL_CONSENT_TEXT,
  ECOA_FOOTER_NOTICE,
} from './consumer-consent';

/* ------------------------------------------------------------------ *
 * SERVER-ONLY: consent receipt store + FCRA verifier (SEC-006 / Task #45)
 *
 * The exports below run only inside the BFF route handlers. They live
 * in this file (vs. a sibling) because the brief mandates a single
 * consent module — the disclosure version constant above and the
 * verifier here MUST stay in lockstep. Bumping the version without
 * touching the verifier would silently invalidate every active
 * consent and is exactly the audit failure we're guarding against.
 *
 * Client bundles import this file too (for `captureConsent` etc.) so
 * the Map at module scope rides along to the browser unused. Cheap
 * enough — the entire store is in-memory and bounded.
 *
 * Why a UUID receipt id (vs. composite `${appId}:${sessionId}`):
 *   - The HighSale prequal route must verify a SPECIFIC receipt was
 *     captured. Composite keys leak the session id into log lines and
 *     URLs; a UUID is opaque and safe to log.
 *   - The receipt id is the audit chain pointer that survives
 *     application id changes (re-attribution, merge flows).
 * ------------------------------------------------------------------ */

/**
 * Stored consent receipt shape — extends the wire body with the
 * server-minted id, server-stamped timestamp, and request metadata.
 */
export interface ConsentReceipt {
  /** Server-minted UUID v4 — opaque pointer surfaced back to the client
   * so subsequent state-changing calls (prequal pulls) can verify the
   * exact receipt that authorized them. */
  id: string;
  applicationId: string;
  sessionId: string;
  disclosureVersion: string;
  consentText: string;
  /** Server time. Never trust the client clock for audit. */
  timestamp: string;
  ip: string;
  userAgent: string;
}

/**
 * Freshness window for an FCRA soft-pull consent. CFPB guidance treats
 * a stale authorization as no authorization — 30 days is the
 * conservative line a SOC 2 auditor will accept without question.
 */
export const FCRA_CONSENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * SEC-105 + P0 fix: in-memory store is now a LAST-RESORT FALLBACK only,
 * used when `hasDb()` is false (local dev without DATABASE_URL). Every
 * production replica MUST hit the `consent_receipts` Postgres table.
 */
const MAX_RECEIPTS_TOTAL = 5_000;
const MAX_RECEIPTS_PER_APPLICATION = 5;

// Dynamic imports keep `pg` + `safe-log` out of the client bundle.
async function loadDbAndLog() {
  const [{ hasDb }, { safeLog }] = await Promise.all([import('./db'), import('./safe-log')]);
  return { hasDb, safeLog };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Two indexes over the same set of receipts:
 *   - `RECEIPTS_BY_COMPOSITE` keyed by `${applicationId}:${sessionId}`
 *     so a same-session retry is idempotent (overwrite in place).
 *   - `RECEIPTS_BY_ID` keyed by the UUID so the verifier can look up
 *     a specific receipt in O(1).
 */
const RECEIPTS_BY_COMPOSITE = new Map<string, ConsentReceipt>();
const RECEIPTS_BY_ID = new Map<string, ConsentReceipt>();

function compositeKey(applicationId: string, sessionId: string): string {
  return `${applicationId}:${sessionId}`;
}

function pruneReceiptsForApplication(applicationId: string): void {
  const matching: ConsentReceipt[] = [];
  for (const rec of RECEIPTS_BY_COMPOSITE.values()) {
    if (rec.applicationId === applicationId) matching.push(rec);
  }
  while (matching.length >= MAX_RECEIPTS_PER_APPLICATION) {
    const oldest = matching.shift();
    if (!oldest) break;
    RECEIPTS_BY_COMPOSITE.delete(compositeKey(oldest.applicationId, oldest.sessionId));
    RECEIPTS_BY_ID.delete(oldest.id);
  }
}

function pruneReceiptsGlobal(): void {
  while (RECEIPTS_BY_COMPOSITE.size >= MAX_RECEIPTS_TOTAL) {
    const oldestKey = RECEIPTS_BY_COMPOSITE.keys().next().value;
    if (!oldestKey) return;
    const oldest = RECEIPTS_BY_COMPOSITE.get(oldestKey);
    RECEIPTS_BY_COMPOSITE.delete(oldestKey);
    if (oldest) RECEIPTS_BY_ID.delete(oldest.id);
  }
}

/**
 * Server-side UUID v4. Falls back to `node:crypto` on platforms where
 * Web Crypto isn't ambient (older Node, but Next.js Node runtime always
 * exposes `crypto.randomUUID`). Edge-runtime safe.
 */
function serverUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Last-resort fallback so the call site never throws — matches the
  // shape produced by `crypto.randomUUID` for downstream parsers.
  const bytes = new Uint8Array(16);
  (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Persist a consent receipt. Same-session retries overwrite in place
 * and keep the original receipt id so the consumer never sees a new
 * id appear under their feet during a retry.
 */
export async function storeConsentReceipt(input: {
  applicationId: string;
  sessionId: string;
  disclosureVersion: string;
  consentText: string;
  ip: string;
  userAgent: string;
  partnerId?: string;
  brand?: string;
}): Promise<ConsentReceipt> {
  const { hasDb, safeLog } = await loadDbAndLog();

  if (hasDb()) {
    try {
      const { storeReceipt, getLatestReceiptForSession } = await import('./db/consent-receipts');
      const existing = await getLatestReceiptForSession(input.applicationId, input.sessionId);
      const receiptId = existing?.id ?? serverUuid();
      const signatureHash = await sha256Hex(input.consentText);

      const row = await storeReceipt({
        id: receiptId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        partnerId: input.partnerId ?? null,
        brand: input.brand ?? 'unknown',
        disclosureVersion: input.disclosureVersion,
        capturedIp: input.ip,
        capturedUserAgent: input.userAgent,
        signatureHash,
        rawText: input.consentText,
      });

      return {
        id: row.id,
        applicationId: row.applicationId,
        sessionId: row.sessionId ?? '',
        disclosureVersion: row.disclosureVersion,
        consentText: row.rawText,
        timestamp: row.capturedAt.toISOString(),
        ip: row.capturedIp,
        userAgent: row.capturedUserAgent ?? '',
      };
    } catch (err) {
      safeLog.error({
        event: 'consent.db_write_failed',
        applicationId: input.applicationId,
        msg: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  safeLog.error({
    event: 'consent.db_unavailable',
    applicationId: input.applicationId,
  });

  const key = compositeKey(input.applicationId, input.sessionId);
  const existing = RECEIPTS_BY_COMPOSITE.get(key);

  if (!existing) {
    pruneReceiptsForApplication(input.applicationId);
    pruneReceiptsGlobal();
  }

  const receipt: ConsentReceipt = {
    id: existing?.id ?? serverUuid(),
    applicationId: input.applicationId,
    sessionId: input.sessionId,
    disclosureVersion: input.disclosureVersion,
    consentText: input.consentText,
    timestamp: new Date().toISOString(),
    ip: input.ip,
    userAgent: input.userAgent,
  };

  RECEIPTS_BY_COMPOSITE.set(key, receipt);
  RECEIPTS_BY_ID.set(receipt.id, receipt);
  return receipt;
}

export async function findConsentReceiptById(id: string): Promise<ConsentReceipt | undefined> {
  const { hasDb, safeLog } = await loadDbAndLog();
  if (hasDb()) {
    try {
      const { getReceiptById } = await import('./db/consent-receipts');
      const row = await getReceiptById(id);
      if (!row) return undefined;
      return {
        id: row.id,
        applicationId: row.applicationId,
        sessionId: row.sessionId ?? '',
        disclosureVersion: row.disclosureVersion,
        consentText: row.rawText,
        timestamp: row.capturedAt.toISOString(),
        ip: row.capturedIp,
        userAgent: row.capturedUserAgent ?? '',
      };
    } catch (err) {
      safeLog.error({
        event: 'consent.db_read_failed',
        receiptId: id,
        msg: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }
  return RECEIPTS_BY_ID.get(id);
}

export async function listConsentReceiptsForApplication(
  applicationId: string,
): Promise<ConsentReceipt[]> {
  const { hasDb, safeLog } = await loadDbAndLog();
  if (hasDb()) {
    try {
      const { getReceiptByApplicationId } = await import('./db/consent-receipts');
      const rows = await getReceiptByApplicationId(applicationId);
      return rows.map((row) => ({
        id: row.id,
        applicationId: row.applicationId,
        sessionId: row.sessionId ?? '',
        disclosureVersion: row.disclosureVersion,
        consentText: row.rawText,
        timestamp: row.capturedAt.toISOString(),
        ip: row.capturedIp,
        userAgent: row.capturedUserAgent ?? '',
      }));
    } catch (err) {
      safeLog.error({
        event: 'consent.db_list_failed',
        applicationId,
        msg: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }
  const out: ConsentReceipt[] = [];
  for (const rec of RECEIPTS_BY_COMPOSITE.values()) {
    if (rec.applicationId === applicationId) out.push(rec);
  }
  return out;
}

/** Test-only reset. Production code never imports this. */
export function __resetConsentReceiptStoreForTests(): void {
  RECEIPTS_BY_COMPOSITE.clear();
  RECEIPTS_BY_ID.clear();
}

/* ------------------------------------------------------------------ *
 * FCRA consent verifier
 *
 * 15 U.S.C. § 1681b — "permissible purpose" — requires that any soft
 * credit inquiry be backed by a consumer authorization for THIS
 * specific application. The verifier enforces four invariants:
 *
 *   1. Receipt exists (consent was actually captured)
 *   2. Receipt's applicationId matches the pull's applicationId
 *      (block cross-application replay of a captured consent)
 *   3. Receipt was captured within FCRA_CONSENT_MAX_AGE_MS
 *      (CFPB rejects stale authorizations)
 *   4. Receipt's disclosureVersion matches SOFT_PULL_DISCLOSURE_VERSION
 *      (if legal updated the disclosure, the consumer must re-consent)
 *
 * Any failure returns a typed reason so the route handler can surface
 * it in a Problem Details body without leaking receipt internals.
 * ------------------------------------------------------------------ */

export type FCRAConsentVerifyFailureReason =
  | 'not_found'
  | 'expired'
  | 'wrong_application'
  | 'wrong_disclosure_version';

export type FCRAConsentVerifyResult =
  | { valid: true; disclosureVersion: string; capturedAt: string; receiptId: string }
  | { valid: false; reason: FCRAConsentVerifyFailureReason };

export async function verifyFCRAConsent(
  consentReceiptId: string,
  applicationId: string,
  /** Injectable for tests; defaults to wall-clock. */
  now: number = Date.now(),
): Promise<FCRAConsentVerifyResult> {
  const receipt = await findConsentReceiptById(consentReceiptId);
  if (!receipt) return { valid: false, reason: 'not_found' };

  // Order matters: applicationId mismatch is the cross-app replay
  // signal — surface it BEFORE the freshness check so an attacker
  // probing freshness can't distinguish "expired" from "wrong app".
  if (receipt.applicationId !== applicationId) {
    return { valid: false, reason: 'wrong_application' };
  }

  if (receipt.disclosureVersion !== SOFT_PULL_DISCLOSURE_VERSION) {
    return { valid: false, reason: 'wrong_disclosure_version' };
  }

  const capturedAtMs = Date.parse(receipt.timestamp);
  // NaN guard: an unparseable timestamp is corruption — treat as expired.
  if (!Number.isFinite(capturedAtMs) || now - capturedAtMs > FCRA_CONSENT_MAX_AGE_MS) {
    return { valid: false, reason: 'expired' };
  }

  return {
    valid: true,
    disclosureVersion: receipt.disclosureVersion,
    capturedAt: receipt.timestamp,
    receiptId: receipt.id,
  };
}

/**
 * Public list of lenders the consumer may be matched with. Derived
 * from apps/partner-portal/lib/marketplace-data.ts at build time.
 * KEEP IN SYNC with that file's `marketplaceLenders` array.
 */
