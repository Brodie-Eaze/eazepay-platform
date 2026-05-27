/**
 * Partner API key verification — stub.
 *
 * Stub posture (SEC-202)
 * ----------------------
 * The public `/api/v1/*` surface needs `Authorization: Bearer <key>`
 * to gate write endpoints. No real partner keys have been provisioned
 * yet (the issuance flow + storage table land in a follow-up PR), so
 * this verifier rejects every token. Fail-closed is the only safe
 * default for an auth check that's wired but unconfigured — the
 * alternative (return a synthetic partner id during the cutover)
 * would silently grant write access to anonymous callers, which is
 * exactly the SEC-202 finding we're fixing.
 *
 * When real keys land
 * -------------------
 * Replace the body of `verifyPartnerApiKey` with:
 *   1. Constant-time compare the bearer token against `partner_api_keys`
 *      rows (lookup keyed on a SHA-256 prefix to avoid leaking via
 *      timing, then constant-time compare the full hash).
 *   2. Reject revoked / expired rows.
 *   3. Return `{ partnerId }` from the matched row.
 * The callers don't need to change — they already treat `null` as
 * "reject with 401 unauthorized".
 *
 * Why a separate module: this verifier will be called from every
 * `/api/v1/*` write handler. Centralising it now means the future swap
 * to real key lookup happens in one place; centralising the
 * fail-closed default means no handler accidentally trusts an
 * inline boolean.
 */

export interface PartnerPrincipal {
  partnerId: string;
}

/**
 * Verify a partner API key (the value of the `Authorization: Bearer ...`
 * header, with the `Bearer ` prefix already stripped). Returns the
 * resolved principal on success or `null` on failure. Callers MUST
 * treat `null` as 401; do not branch on any sub-case.
 *
 * Stub: always returns null. See module docblock.
 */
export async function verifyPartnerApiKey(
  _token: string,
): Promise<PartnerPrincipal | null> {
  // Intentionally fail-closed until real key issuance + storage land.
  return null;
}

/**
 * Helper: extract the bearer token from an `Authorization` header.
 * Returns null for missing / malformed / non-Bearer schemes so the
 * caller's null-handling collapses to one branch.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token ? token : null;
}
