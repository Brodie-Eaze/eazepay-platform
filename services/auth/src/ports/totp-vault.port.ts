import type { UserId } from '@eazepay/shared-types';

/**
 * Port for sealing / opening TOTP shared secrets.
 *
 * Why a port, not a direct import of services/user's PiiVaultService:
 * the service-user package depends on service-auth (one-way), so
 * importing it back here would create a cycle in the workspace graph.
 * Instead, the host application (apps/api/src/app/app.module.ts) wires
 * a concrete adapter that delegates to `PiiVaultService.sealOpaque`
 * with `scope: 'totp_secret'` + `userId` AAD bindings. A default dev
 * adapter is shipped with this module so the auth service compiles
 * and tests run without the user-service dependency.
 *
 * Production threat being closed: a raw DB dump must not expose any
 * user's TOTP shared secret. `sealTotpSecret` returns an opaque
 * envelope that requires both:
 *   - the KEK held in KMS (or LocalKeyManager.localKekHex in dev)
 *   - the SAME `userId` + scope context bound at seal time
 * before plaintext recovery — mirroring the protection already in
 * place for webhook signing secrets and BeneficialOwner PII.
 */
export interface TotpVaultPort {
  sealTotpSecret(input: { userId: UserId; secretBase32: string }): Promise<string>;

  /**
   * Decrypt a previously-sealed TOTP secret. Throws on AAD mismatch —
   * a ciphertext sealed for user A cannot be opened with user B's
   * context.
   */
  openTotpSecret(input: { userId: UserId; envelope: string }): Promise<string>;
}

export const TOTP_VAULT = Symbol('TOTP_VAULT');
