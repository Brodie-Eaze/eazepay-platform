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
 * Cookie value format:
 *   `${userId}.${brand}.${partnerId}.${expiresAtEpochMs}.${hmacHex}`
 *
 * Where `hmacHex = HMAC_SHA256(secret, '${userId}.${brand}.${partnerId}.${expiresAtEpochMs}')`.
 *
 * The same `DEMO_COOKIE_SECRET` env is reused for the HMAC key — one
 * secret to rotate, one secret to set in Railway. Production must set
 * a ≥32-char value or `resolveSecret` throws.
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
  // Re-use DEMO_COOKIE_SECRET — same threat model, same rotation cadence.
  const fromEnv = process.env.DEMO_COOKIE_SECRET;
  if (fromEnv && fromEnv.length >= MIN_SECRET_BYTES) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DEMO_COOKIE_SECRET is not set or is shorter than 32 chars. ' +
        'Account sessions require it. Set a long random string in production.',
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
  const payload = `${input.userId}.${input.brand}.${input.partnerId}.${expiresAtMs}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
  return `${payload}.${bytesToHex(sig)}`;
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
  if (parts.length !== 4) return null;
  const [userId, brand, partnerId, expiresStr] = parts as [string, string, string, string];
  if (!['medpay', 'tradepay', 'coachpay'].includes(brand)) return null;
  const expiresAtMs = Number(expiresStr);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
  if (Date.now() >= expiresAtMs) return null;

  const expectedSig = await (async () => {
    const key = await getKey();
    const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
    return new Uint8Array(sig);
  })();
  const providedSig = hexToBytes(sigHex);
  if (!providedSig || !constantTimeEqual(expectedSig, providedSig)) return null;

  return {
    userId,
    brand: brand as 'medpay' | 'tradepay' | 'coachpay',
    partnerId,
    expiresAtMs,
  };
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
