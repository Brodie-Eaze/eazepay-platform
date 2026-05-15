/**
 * Consumer-side consent + session hardening helpers.
 *
 * THIS FILE EXISTS BECAUSE
 * ------------------------
 * The consumer apply flow has to satisfy four regulatory regimes at the
 * same time — FCRA (soft-pull authorization), Reg B / ECOA (equal credit
 * opportunity disclosures), the E-SIGN Act (electronic consent record),
 * and SOC 2 (audit trail). Every consumer-facing page needs the same
 * primitives, so we centralize them here rather than copy-pasting.
 *
 * If you change the disclosure text or the consent receipt fields,
 * BUMP `SOFT_PULL_DISCLOSURE_VERSION` so old consents stay distinguishable
 * from new ones in the audit chain.
 */

export const SOFT_PULL_DISCLOSURE_VERSION = '2026-05-15.v1';

/**
 * The exact text the consumer sees and consents to. Verbatim from the
 * compliance review. DO NOT edit without re-bumping the version above
 * AND running it past legal — this string is the legal artifact that
 * proves the consumer authorized the soft-pull under FCRA §604(a)(2).
 */
export const SOFT_PULL_CONSENT_TEXT =
  'I authorize EazePay and its participating lenders to obtain my consumer credit information from credit reporting agencies. I understand this is a soft inquiry and will not affect my credit score. I have read the Privacy Policy and E-Sign Disclosure.';

/**
 * ECOA / Reg B footer notice. Required on every page where the consumer
 * provides credit-decision data. The CFPB has fined brokers for omitting
 * the adverse-action lookback line, so it stays even on the landing
 * step where no data is collected yet (defensive default).
 */
export const ECOA_FOOTER_NOTICE =
  'EazePay is not a lender. We connect you with financing partners. The consumer reporting agencies used in this process can be reached at: Experian, Equifax, TransUnion. You have the right to a free credit report annually at annualcreditreport.com. If credit is denied, you will receive an Adverse Action Notice within 30 days explaining why.';

/**
 * Session id storage key. Bound to a cookie (httpOnly when the BFF
 * route writes it) AND a sessionStorage mirror so the client can read
 * its own session id for receipt mirroring. Anti-replay: every consent,
 * form submit, and document upload from this consumer session carries
 * this id, so an attacker can't replay a captured POST under a fresh
 * session.
 */
const SESSION_KEY = 'eazepay.session';

function uuid(): string {
  // crypto.randomUUID is widely supported (Safari 15.4+, all evergreen
  // browsers). The fallback to getRandomValues keeps us safe on the
  // long tail of older devices the consumer flow has to serve.
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  (c ?? globalThis.crypto).getRandomValues(bytes);
  // RFC 4122 v4 layout.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Get-or-create the per-tab session id. Mirrors into a `eazepay_session`
 * cookie with SameSite=Lax so the BFF route can read it server-side.
 * The cookie is intentionally NOT httpOnly here because we need the
 * client to read it to mirror into localStorage for the audit chain;
 * in production a thin BFF route should set httpOnly + sign the value.
 */
export function ensureSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    window.sessionStorage.setItem(SESSION_KEY, id);
    // 1-hour lifetime — longer than the form takes, shorter than a
    // forgotten-laptop window. Refresh on the next page load.
    document.cookie = `eazepay_session=${id}; Path=/; Max-Age=3600; SameSite=Lax`;
  }
  return id;
}

/**
 * Anti-replay check. Returns false if the session cookie has gone
 * missing mid-flow (consumer cleared cookies, opened in a new browser,
 * had it stripped by a privacy extension). The caller MUST send the
 * consumer back to step 1 in that case — never accept stale form state
 * tied to a session that no longer exists.
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

/**
 * Generate the application id used as the consent receipt key. Real
 * applications get a server-assigned id when POST /api/v1/applications
 * returns 201; this client-side id is a placeholder so the consent
 * receipt can be filed even when the consumer abandons before the
 * server has assigned one. The two are reconciled on submit.
 */
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
 * Persist the consent receipt to localStorage AND POST to the BFF.
 * Mirroring to localStorage means the consumer can prove what they
 * agreed to from their own browser if they ever dispute the inquiry
 * (FCRA §611). The POST is the canonical audit chain entry.
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

  // Mirror to localStorage. Keyed by application id so an operator
  // helping a consumer over the phone can ask them to read back the
  // value via the browser console.
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `eazepay.consent.${args.applicationId}`,
        JSON.stringify(receipt),
      );
    }
  } catch {
    // Quota exceeded or privacy-mode block. Non-fatal — the POST below
    // is the source of truth.
  }

  // POST to the BFF. Same-origin when the apps share a domain;
  // cross-origin when consumer-web and partner-portal are split. The
  // BFF will pull IP + userAgent from request headers and stamp a
  // server-side timestamp before persisting.
  try {
    const res = await fetch('/api/applications/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    // Network failure. The localStorage mirror is the fallback proof.
    // The consumer is still allowed to continue — blocking them on a
    // network blip during the consent POST would be a worse UX than
    // having a momentary gap in the audit chain.
    return { ok: false, timestamp };
  }
}

/**
 * Mask an SSN for display: '123-45-6789' → '***-**-6789'. Used after
 * the consumer types it into the field so the visible form value never
 * shows the full SSN to a shoulder-surfer or screen-share viewer.
 */
export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return ssn;
  return `***-**-${digits.slice(-4)}`;
}

/**
 * Mask a bank account number for display: '123456789' → '****6789'.
 */
export function maskAccountNumber(acct: string): string {
  const digits = acct.replace(/\D/g, '');
  if (digits.length < 4) return acct;
  return `****${digits.slice(-4)}`;
}

/**
 * List of lenders the consumer's data may be shared with. Pulled from
 * the partner-portal marketplace data file at build time so the list
 * stays in sync. We hardcode the public-facing names here because the
 * full marketplace file references types from `@eazepay/shared-types`
 * that bring server-only deps into the consumer bundle. If/when the
 * shared-types package gets a tree-shakeable export of names-only, swap
 * this for that import.
 *
 * KEEP IN SYNC with apps/partner-portal/lib/marketplace-data.ts.
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
