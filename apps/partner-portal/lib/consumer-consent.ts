/**
 * Consumer-side consent + session hardening helpers (partner-portal).
 *
 * Mirror of apps/consumer-web/lib/consent.ts. We duplicate this file
 * intentionally because:
 *
 *   1. The partner-portal hosts the /apply/<brand> consumer landing
 *      that lives INSIDE the same Next app as the operator-facing
 *      dashboard. Cross-app imports between Next apps in this monorepo
 *      aren't allowed (different tsconfig roots), so the two consumer
 *      surfaces each get their own copy.
 *
 *   2. Both copies post to the SAME BFF route
 *      (POST /api/applications/consent) which lives in partner-portal.
 *      That endpoint is the single source of truth for the audit chain.
 *      The duplication is at the form helper, not at the receipt store.
 *
 * If you change the disclosure text or version, change it in BOTH files
 * (apps/consumer-web/lib/consent.ts and this one).
 */

export const SOFT_PULL_DISCLOSURE_VERSION = '2026-05-15.v1';

/**
 * Verbatim soft-pull consent text. FCRA §604(a)(2) requires the
 * consumer affirmatively authorize the credit pull. The exact string
 * the consumer saw IS the legal artifact, so do not edit without
 * re-bumping the version above AND a fresh legal review.
 */
export const SOFT_PULL_CONSENT_TEXT =
  'I authorize EazePay and its participating lenders to obtain my consumer credit information from credit reporting agencies. I understand this is a soft inquiry and will not affect my credit score. I have read the Privacy Policy and E-Sign Disclosure.';

/**
 * ECOA / Reg B footer notice. Required on every credit-related
 * consumer-facing page. The CFPB has fined brokers for omitting this.
 */
export const ECOA_FOOTER_NOTICE =
  'EazePay is not a lender. We connect you with financing partners. The consumer reporting agencies used in this process can be reached at: Experian, Equifax, TransUnion. You have the right to a free credit report annually at annualcreditreport.com. If credit is denied, you will receive an Adverse Action Notice within 30 days explaining why.';

const SESSION_KEY = 'eazepay.session';

function uuid(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  (c ?? globalThis.crypto).getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Get-or-create the per-tab session id. Mirrors to a SameSite=Lax
 * cookie so the BFF route can read it server-side. Cookie is NOT
 * httpOnly here because the client needs to mirror it into the
 * localStorage consent receipt; production should swap this for a
 * BFF-managed httpOnly signed cookie.
 */
export function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    window.sessionStorage.setItem(SESSION_KEY, id);
    document.cookie = `eazepay_session=${id}; Path=/; Max-Age=3600; SameSite=Lax`;
  }
  return id;
}

/**
 * Anti-replay: cookie still bound to the in-tab session id? Returns
 * false if a privacy extension or new tab cleared the cookie.
 */
export function sessionStillBound(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.sessionStorage.getItem(SESSION_KEY);
  if (!stored) return false;
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith('eazepay_session='))
    ?.split('=')[1];
  return cookie === stored;
}

export function ensureApplicationId(): string {
  if (typeof window === 'undefined') return 'ssr-app';
  const key = 'eazepay.applicationId';
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = `app_local_${uuid().replace(/-/g, '').slice(0, 16)}`;
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

/**
 * Persist the consent receipt (localStorage mirror + POST to BFF).
 * Returns ok=false on network failure but the consumer is allowed to
 * proceed; the localStorage mirror is the fallback audit artifact.
 */
export async function captureConsent(args: {
  applicationId: string;
  sessionId: string;
}): Promise<{ ok: boolean; timestamp: string }> {
  const timestamp = new Date().toISOString();
  const receipt = {
    applicationId: args.applicationId,
    sessionId: args.sessionId,
    disclosureVersion: SOFT_PULL_DISCLOSURE_VERSION,
    consentText: SOFT_PULL_CONSENT_TEXT,
    timestamp,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`eazepay.consent.${args.applicationId}`, JSON.stringify(receipt));
    }
  } catch {
    // localStorage quota / privacy-mode block. Non-fatal.
  }

  try {
    const { csrfHeaders } = await import('./client-csrf');
    const res = await fetch('/api/applications/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        applicationId: args.applicationId,
        sessionId: args.sessionId,
        disclosureVersion: SOFT_PULL_DISCLOSURE_VERSION,
        consentText: SOFT_PULL_CONSENT_TEXT,
        clientTimestamp: timestamp,
      }),
      credentials: 'include',
    });
    return { ok: res.ok, timestamp };
  } catch {
    return { ok: false, timestamp };
  }
}

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
export const PARTICIPATING_LENDERS = [
  'U.S. Bank',
  'Engine.Tech',
  'Queen Street Capital',
  'BuzzPay (by TrueTopia)',
  'Cross River Bank',
  'WebBank',
  'Helia Medical',
  'SageHeal',
  'Orion Capital',
  'Kestrel Trade Finance',
  'Atlas Career Capital',
  'ClearPath Education Finance',
  'Summit Premier Lending',
];
