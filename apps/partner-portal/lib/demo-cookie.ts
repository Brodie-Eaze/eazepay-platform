/**
 * SEC-103 + SEC-109 — signed demo cookie.
 *
 * Background: the demo cookie's value (`eazepay_demo=<preset>`) is
 * trusted by `/api/auth/session/route.ts` to mint the actor record,
 * including `isAdmin: true` for the `master` preset. Pre-fix, the
 * cookie was unsigned plain text. Two attacks:
 *
 *   1. **Direct forge.** A user with shell access can set the cookie
 *      to any preset. Without signing, the server has no way to know.
 *
 *   2. **CSRF fixation.** `/api/auth/demo` accepted POSTs from any
 *      origin (Lax SameSite admits top-level form submissions). A
 *      phishing page could mint `eazepay_demo=master` in the victim's
 *      browser, and the victim's next legitimate visit would resolve
 *      as a master admin.
 *
 * This module is the signed-cookie primitive. The cookie value is now:
 *
 *     `${preset}.${expiresAtEpochMs}.${hmacSha256Hex(secret, '${preset}.${expiresAtEpochMs}')}`
 *
 * `signDemoPreset` mints a value; `readSignedDemoPreset` parses and
 * verifies. Verification is constant-time + checks `expiresAt`. Any
 * tamper, truncation, or stale value returns null.
 *
 * Edge-runtime safe: uses Web Crypto (`crypto.subtle`) — works in the
 * Next middleware (Edge), Node API routes, and browser tests alike.
 *
 * ## Secret
 *
 * Read from `DEMO_COOKIE_SECRET` env. In production, this MUST be set
 * to a long random string (≥32 bytes hex); the module throws at first
 * sign/verify call if missing or too short. In non-production, a
 * deterministic placeholder is used so local dev + CI work without env
 * setup — production safety is preserved by the throw.
 */

const ENCODER = new TextEncoder();
const MIN_SECRET_BYTES = 32;
const DEV_PLACEHOLDER_SECRET = 'dev-only-demo-cookie-secret-DO-NOT-USE-IN-PRODUCTION-32B+';

let cachedKey: Promise<CryptoKey> | null = null;
let cachedSecret: string | null = null;

function resolveSecret(): string {
  const fromEnv = process.env.DEMO_COOKIE_SECRET;
  if (fromEnv && fromEnv.length >= MIN_SECRET_BYTES) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DEMO_COOKIE_SECRET is not set or is shorter than 32 chars. ' +
        'Set a long random string in production (e.g. `openssl rand -hex 32`).',
    );
  }
  return DEV_PLACEHOLDER_SECRET;
}

async function getKey(): Promise<CryptoKey> {
  const secret = resolveSecret();
  // Bust the cache if the secret changed (test reset / rotation).
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
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i]!.toString(16).padStart(2, '0');
  }
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

export interface SignedDemoPreset {
  preset: string;
  expiresAtMs: number;
}

/**
 * Mint a signed cookie value. `ttlSeconds` controls the embedded
 * expiry — typically matches the cookie's browser `maxAge` so both
 * layers expire together.
 */
export async function signDemoPreset(preset: string, ttlSeconds: number): Promise<string> {
  const expiresAtMs = Date.now() + ttlSeconds * 1000;
  const payload = `${preset}.${expiresAtMs}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
  return `${payload}.${bytesToHex(sig)}`;
}

/**
 * Parse + verify a signed cookie. Returns the preset + expiry on
 * success, or null if the value is malformed, the signature doesn't
 * verify, or the embedded expiry has passed.
 *
 * This is the load-bearing check: every reader of `eazepay_demo` must
 * use this function. A bare `req.cookies.get('eazepay_demo')?.value`
 * call elsewhere is a regression and should be flagged in review.
 */
export async function readSignedDemoPreset(
  cookieValue: string | undefined | null,
): Promise<SignedDemoPreset | null> {
  if (!cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = cookieValue.slice(0, lastDot);
  const sigHex = cookieValue.slice(lastDot + 1);

  const parts = payload.split('.');
  if (parts.length !== 2) return null;
  const [preset, expiresStr] = parts as [string, string];
  const expiresAtMs = Number(expiresStr);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
  if (Date.now() >= expiresAtMs) return null;

  const expectedSig = await (async () => {
    const key = await getKey();
    const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload));
    return new Uint8Array(sig);
  })();

  const providedSig = hexToBytes(sigHex);
  if (!providedSig) return null;
  if (!constantTimeEqual(expectedSig, providedSig)) return null;

  return { preset, expiresAtMs };
}

/**
 * Synchronous variant used in tight loops where the caller has already
 * awaited verification once and just wants to parse the unsigned
 * portion. Returns `{preset, expiresAtMs}` from the cookie bytes
 * without verifying — caller MUST have verified separately. Used by
 * the synchronous `getSessionContext` helper, which now calls into
 * the async verify path first and threads the result through.
 */
export function unsafeParseSignedDemoPreset(
  cookieValue: string | undefined | null,
): { preset: string; expiresAtMs: number } | null {
  if (!cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const parts = cookieValue.slice(0, lastDot).split('.');
  if (parts.length !== 2) return null;
  const [preset, expiresStr] = parts as [string, string];
  const expiresAtMs = Number(expiresStr);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
  return { preset, expiresAtMs };
}

/** Test/util — reset the module cache so tests can swap the secret. */
export function _resetDemoCookieKeyCache(): void {
  cachedKey = null;
  cachedSecret = null;
}
