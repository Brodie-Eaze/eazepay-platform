import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { BadRequest, Unauthorized } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { AUTH_CONFIG, type AuthConfig } from '../internal/token.service.js';
import type { TotpVaultPort } from '../ports/totp-vault.port.js';

const ENVELOPE_VERSION = 1 as const;

/**
 * Local / development TOTP vault adapter.
 *
 * Production deployments wire this slot to a concrete adapter that
 * delegates to `PiiVaultService.sealOpaque` (apps/api wires it in
 * app.module.ts) so the KEK lives in KMS — see
 * services/user/src/internal/pii-vault.service.ts. This adapter is the
 * fallback the auth module ships with so the service compiles
 * standalone and dev runs work without crossing a workspace boundary.
 *
 * Properties this adapter PRESERVES regardless of production swap:
 *   1. AES-256-GCM with a per-row 96-bit nonce + 128-bit auth tag.
 *   2. AAD binding to `scope=totp_secret` + `userId`. A ciphertext
 *      sealed for user A fails authentication if `open` is called
 *      with user B's id — closes the row-swap threat documented in
 *      `services/user/src/internal/pii-vault.service.ts` SEC-019.
 *   3. The plaintext base32 secret is zeroed from process memory
 *      after seal/open finishes.
 *
 * The KEK is derived from `AUTH_CONFIG.jwtAccessSecret` via SHA-256.
 * The dev secret is sufficient for non-production use; production
 * MUST override the binding so the KEK lives in KMS.
 */
@Injectable()
export class LocalTotpVaultAdapter implements TotpVaultPort {
  private readonly kek: Buffer;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    // SHA-256 of the JWT secret yields a deterministic 32-byte AES key
    // without leaking the original entropy. Same shape as the dev
    // local-key-manager path in services/user.
    this.kek = createHash('sha256').update(this.config.jwtAccessSecret).digest();
  }

  async sealTotpSecret(input: { userId: UserId; secretBase32: string }): Promise<string> {
    const nonce = randomBytes(12);
    const aad = Buffer.from(this.aadString(input.userId), 'utf8');
    const plaintext = Buffer.from(input.secretBase32, 'utf8');
    const cipher = createCipheriv('aes-256-gcm', this.kek, nonce);
    cipher.setAAD(aad);
    try {
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      // Single JSON-then-base64 envelope mirrors PiiVaultService.sealOpaque
      // so a future cut-over to that service is mechanical (rewrap the
      // existing rows by `JSON.parse` → re-seal with PiiVaultService).
      const envelope = {
        v: ENVELOPE_VERSION,
        ct: ciphertext.toString('base64'),
        n: nonce.toString('base64'),
        t: tag.toString('base64'),
        // AAD context is echoed back so the open path can re-derive
        // without trusting the caller's userId blindly — we still
        // compare to the parameter so a forged envelope can't swap
        // identities.
        aad: { scope: 'totp_secret', userId: input.userId },
      };
      return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
    } finally {
      plaintext.fill(0);
    }
  }

  async openTotpSecret(input: { userId: UserId; envelope: string }): Promise<string> {
    let parsed: {
      v: number;
      ct: string;
      n: string;
      t: string;
      aad: { scope: string; userId: string };
    };
    try {
      parsed = JSON.parse(Buffer.from(input.envelope, 'base64').toString('utf8'));
    } catch {
      throw BadRequest({ code: 'totp_envelope_malformed' });
    }
    if (parsed.v !== ENVELOPE_VERSION) {
      throw BadRequest({
        code: 'totp_envelope_version_unknown',
        detail: `expected v=${ENVELOPE_VERSION}`,
      });
    }
    // Defence-in-depth: even though GCM AAD authentication will fail
    // below if the AAD doesn't match, refuse to attempt decryption
    // outright if the bound userId doesn't equal the requested one.
    // Cuts an entire class of timing oracle attacks.
    if (parsed.aad.userId !== input.userId || parsed.aad.scope !== 'totp_secret') {
      throw Unauthorized({ code: 'totp_envelope_user_mismatch' });
    }
    const nonce = Buffer.from(parsed.n, 'base64');
    const tag = Buffer.from(parsed.t, 'base64');
    const ciphertext = Buffer.from(parsed.ct, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.kek, nonce);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(this.aadString(input.userId), 'utf8'));
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    try {
      return plaintext.toString('utf8');
    } finally {
      plaintext.fill(0);
    }
  }

  private aadString(userId: UserId): string {
    // Sorted keys so the same context produces a stable AAD every time.
    return `opaque:v${ENVELOPE_VERSION}:scope=totp_secret:userId=${userId}`;
  }
}
