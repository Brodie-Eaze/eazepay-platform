/**
 * Signed account-session cookie for partner-portal real (non-demo)
 * sessions.
 *
 * Same posture as `demo-cookie.ts` (SEC-103) — HMAC-SHA256 over the
 * payload, constant-time compare on verify, embedded expiry. Distinct
 * cookie name (`eazepay_account`) so demo + account sessions can
 * coexist during the transition window (some demo tiles use the demo
 * cookie; a real signed-up business gets an account cookie).
 *
 * Cookie value format (v2, SEC-204):
 *   `v2.${b64uUserId}.${b64uBrand}.${b64uPartnerId}.${expiresAtEpochMs}.${hmacHex}`
 *
 * Where each field is base64url-encoded (no `=` padding, no `.` chars
 * in the alphabet) so the field delimiter `.` is unambiguous, and
 * `hmacHex = HMAC_SHA256(secret, '${b64uUserId}.${b64uBrand}.${b64uPartnerId}.${expiresAtEpochMs}')`.
 *
 * SEC-204 — canonicalization rationale
 * ------------------------------------
 * v1 of the cookie joined raw field values with `.` as a delimiter.
 * That was canonicalization-fragile: if any field ever contained a
 * literal `.` (a partner-id like `p.helio`, a future brand name with
 * a dot, a user-id with email semantics), the parse split into the
 * wrong number of fields and either rejected or — worse — accepted a
 * tampered payload whose dot-rearrangement still validated. Base64url
 * gives a delimiter-safe alphabet so the split is one-to-one with the
 * fields, end of class of bug.
 *
 * Backwards compat: `readSignedAccountSession` accepts BOTH v1 and v2
 * shapes during the rollout window. New cookies are minted as v2 only.
 * Once all live sessions have rolled (8h TTL = same-day), v1 acceptance
 * can be removed in a follow-up.
 *
 * ## Secret resolution
 *
 * Prefers `ACCOUNT_COOKIE_SECRET`; falls back to `DEMO_COOKIE_SECRET`
 * for backward compatibility with deployments that pre-date the split.
 * Splitting the secrets means rotating the account secret signs every
 * real account out without invalidating live demo sessions, and vice
 * versa — each cookie class can be rotated on its own schedule.
 *
 * Production must set a ≥32-char value or `resolveSecret` throws. The
 * boot-time validator in `lib/env.ts` catches the missing-secret case
 * at module-load time so the process fails fast rather than 500-ing
 * on first request.
 *
 * When apps/api lands with real JWTs from Cognito, this module is
 * replaced by a JWT verifier; the cookie name stays so the partner-
 * portal session-resolution code keeps working through the swap.
 */

const ENCODER = new TextEncoder();
const MIN_SECRET_BYTES = 32;
const DEV_PLACEHOLDER_SECRET = 'dev-only-account-cookie-secret-DO-NOT-USE-IN-PRODUCTION-32B+';

let cachedKey: Promise<CryptoKey> | null = null;
let cachedSecret: string | null = null;

function resolveSecret(): string {
  // Prefer the dedicated account secret; fall back to the demo secret
  // for backward-compat with existing deployments. New deploys SHOULD
  // set both explicitly — see `.env.example`.
  const fromEnv = process.env.ACCOUNT_COOKIE_SECRET ?? process.env.DEMO_COOKIE_SECRET;
  if (fromEnv && fromEnv.length >= MIN_SECRET_BYTES) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ACCOUNT_COOKIE_SECRET (or fallback DEMO_COOKIE_SECRET) is not set or is ' +
        'shorter than 32 chars. Account sessions require it. Set a long random ' +
        'string in production — generate with `openssl rand -hex 32`.',
    );
  }
  return DEV_PLACEHOLDER_SECRET;
}

async function getKey(): Promise<CryptoKey> {
  const secret = resolveSecret();
  if (cachedSecret !== secret) {
    cachedSecret = secret;
    cachedKey = crypto.subtle.importKey(
      'raw',
      ENCODER.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }
  return cachedKey!;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < arr.length; i++) hex += arr[i]!.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) return null;
    out[i] = b;
  }
  return out;
}

/**
 * Base64url encode a UTF-8 string. URL-safe alphabet (no `+`, `/`,
 * `=`), so the literal `.` we use as a field delimiter never appears
 * inside a field — eliminating the SEC-204 canonicalization gap.
 */
function b64uEncode(s: string): string {
  const bytes = ENCODER.encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // btoa is globally available in both edge runtime and Node 18+.
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64uDecode(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  // Restore padding.
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export interface AccountSession {
  userId: string;
  brand: 'medpay' | 'tradepay' | 'coachpay';
  partnerId: string;
  expiresAtMs: number;
}

export async function signAccountSession(
  input: { userId: string; brand: 'medpay' | 'tradepay' | 'coachpay'; partnerId: string },
  ttlSeconds: number,
): Promise<string> {
  const expiresAtMs = Date.now() + ttlSeconds * 1000;
  // SEC-204: encode each field as base64url before joining so the `.`
  // delimiter is never ambiguous, regardless of the field's contents.
  const payload = [
    'v2',
    b64uEncode(input.userId),
    b64uEncode(input.brand),
    b64uEncode(input.partnerId),
    String(expiresAtMs),
  ].join('.');
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
  return `${payload}.${bytesToHex(sig)}`;
}

async function verifyAndExtract(payload: string, sigHex: string): Promise<boolean> {
  const expectedSig = await (async () => {
    const key = await getKey();
    const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
    return new Uint8Array(sig);
  })();
  const providedSig = hexToBytes(sigHex);
  if (!providedSig || !constantTimeEqual(expectedSig, providedSig)) return false;
  return true;
}

export async function readSignedAccountSession(
  cookieValue: string | undefined | null,
): Promise<AccountSession | null> {
  if (!cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = cookieValue.slice(0, lastDot);
  const sigHex = cookieValue.slice(lastDot + 1);

  const parts = payload.split('.');

  // v2 shape — ['v2', b64uUserId, b64uBrand, b64uPartnerId, expiresMs]
  if (parts.length === 5 && parts[0] === 'v2') {
    const [, b64UserId, b64Brand, b64PartnerId, expiresStr] = parts as [
      string,
      string,
      string,
      string,
      string,
    ];
    const userId = b64uDecode(b64UserId);
    const brand = b64uDecode(b64Brand);
    const partnerId = b64uDecode(b64PartnerId);
    if (userId === null || brand === null || partnerId === null) return null;
    if (!['medpay', 'tradepay', 'coachpay'].includes(brand)) return null;
    const expiresAtMs = Number(expiresStr);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
    if (Date.now() >= expiresAtMs) return null;
    if (!(await verifyAndExtract(payload, sigHex))) return null;
    return {
      userId,
      brand: brand as 'medpay' | 'tradepay' | 'coachpay',
      partnerId,
      expiresAtMs,
    };
  }

  // v1 shape — ['userId', 'brand', 'partnerId', 'expiresMs']. Kept for
  // backwards compat during the 8h-TTL rollout window; remove in a
  // follow-up once we're confident all minted v1 cookies have expired.
  if (parts.length === 4) {
    const [userId, brand, partnerId, expiresStr] = parts as [string, string, string, string];
    if (!['medpay', 'tradepay', 'coachpay'].includes(brand)) return null;
    const expiresAtMs = Number(expiresStr);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
    if (Date.now() >= expiresAtMs) return null;
    if (!(await verifyAndExtract(payload, sigHex))) return null;
    return {
      userId,
      brand: brand as 'medpay' | 'tradepay' | 'coachpay',
      partnerId,
      expiresAtMs,
    };
  }

  return null;
}

export function _resetAccountCookieKeyCache(): void {
  cachedKey = null;
  cachedSecret = null;
}

/** Cookie name + TTL constants — shared by mint + verify sites. */
export const ACCOUNT_COOKIE = {
  name: 'eazepay_account',
  ttlSeconds: 60 * 60 * 8, // 8h
} as const;
