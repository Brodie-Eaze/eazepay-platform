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
      window.localStorage.setItem(
        `eazepay.consent.${args.applicationId}`,
        JSON.stringify(receipt),
      );
    }
  } catch {
    // localStorage quota / privacy-mode block. Non-fatal.
  }

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
    return { ok: false, timestamp };
  }
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
