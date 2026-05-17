import { Inject, Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { PRISMA } from './tokens.js';

/**
 * Encrypts and decrypts LenderConnection credentials.
 *
 * Envelope scheme (parity with PiiVaultService):
 *  1. We hold a Key-Encryption Key (KEK) — in dev a 32-byte hex value
 *     read from LOCAL_KEK_HEX; in prod a KMS CMK reference.
 *  2. Per-row we mint a 32-byte Data-Encryption Key (DEK), encrypt the
 *     plaintext with AES-256-GCM, then encrypt the DEK with the KEK.
 *  3. We store base64(version || iv || tag || encrypted_dek || ciphertext).
 *  4. AAD is `lender_conn:<connectionId>:<field>` so a ciphertext from
 *     one row can't be replayed onto another.
 *
 * Fingerprints are SHA-256 over the plaintext, truncated to 12 hex
 * chars. They are safe to surface in UI ("ep_live_2KvN8…") and let an
 * operator confirm rotation without revealing the secret.
 */
@Injectable()
export class CredentialVaultService {
  private readonly logger = new Logger(CredentialVaultService.name);
  private readonly kek: Buffer;

  constructor(@Inject(PRISMA) _prisma: PrismaClient) {
    void _prisma;
    // Fail closed. A missing or malformed KEK in any environment means
    // every previously-encrypted credential becomes unreadable after
    // restart, and silently rotating to a fresh in-memory KEK is worse
    // than crashing — it advertises healthy operation while
    // irrecoverably losing partner API keys.
    //
    // The single exception is `NODE_ENV=test`, where each test run
    // legitimately wants a fresh key. Everywhere else, refuse to boot.
    const hex = process.env.LOCAL_KEK_HEX;
    if (process.env.NODE_ENV === 'test') {
      this.kek = hex && hex.length === 64 ? Buffer.from(hex, 'hex') : randomBytes(32);
      return;
    }
    if (!hex) {
      throw new Error(
        'LOCAL_KEK_HEX is required to start the credential vault. ' +
          'Generate one with `openssl rand -hex 32` and set it in your environment / Secrets Manager.',
      );
    }
    if (hex.length !== 64) {
      throw new Error(`LOCAL_KEK_HEX must be 64 hex characters (32 bytes); got ${hex.length}.`);
    }
    this.kek = Buffer.from(hex, 'hex');
  }

  /** Encrypt a plaintext credential. Returns base64 envelope + fingerprint. */
  encrypt(plaintext: string, aad: string): { ciphertext: string; fingerprint: string } {
    if (!plaintext) return { ciphertext: '', fingerprint: '' };

    // 1. mint a fresh DEK
    const dek = randomBytes(32);

    // 2. encrypt plaintext with DEK
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // 3. encrypt DEK with KEK
    const kekIv = randomBytes(12);
    const kekCipher = createCipheriv('aes-256-gcm', this.kek, kekIv);
    kekCipher.setAAD(Buffer.from(aad + ':dek', 'utf8'));
    const encryptedDek = Buffer.concat([kekCipher.update(dek), kekCipher.final()]);
    const kekTag = kekCipher.getAuthTag();

    // 4. envelope: version(1) | iv(12) | tag(16) | kekIv(12) | kekTag(16) | encryptedDek(32) | ciphertext(*)
    const envelope = Buffer.concat([
      Buffer.from([1]),
      iv,
      tag,
      kekIv,
      kekTag,
      encryptedDek,
      ciphertext,
    ]);

    const fingerprint = createHash('sha256').update(plaintext).digest('hex').slice(0, 12);
    return { ciphertext: envelope.toString('base64'), fingerprint };
  }

  /** Decrypt a stored envelope back to plaintext. */
  decrypt(ciphertextB64: string, aad: string): string {
    if (!ciphertextB64) return '';
    const buf = Buffer.from(ciphertextB64, 'base64');
    if (buf.length < 1 + 12 + 16 + 12 + 16 + 32) {
      throw new Error('credential envelope corrupt');
    }
    const version = buf[0];
    if (version !== 1) throw new Error(`unknown envelope version ${version}`);

    let o = 1;
    const iv = buf.subarray(o, (o += 12));
    const tag = buf.subarray(o, (o += 16));
    const kekIv = buf.subarray(o, (o += 12));
    const kekTag = buf.subarray(o, (o += 16));
    const encryptedDek = buf.subarray(o, (o += 32));
    const ciphertext = buf.subarray(o);

    // 1. decrypt DEK with KEK
    const kekDecipher = createDecipheriv('aes-256-gcm', this.kek, kekIv);
    kekDecipher.setAAD(Buffer.from(aad + ':dek', 'utf8'));
    kekDecipher.setAuthTag(kekTag);
    const dek = Buffer.concat([kekDecipher.update(encryptedDek), kekDecipher.final()]);

    // 2. decrypt payload with DEK
    const decipher = createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  }

  /** Stable masked preview for UI: first 7 chars of fingerprint + bullets. */
  preview(fingerprint: string | null | undefined): string {
    if (!fingerprint) return '••••••••';
    return `ep_*_${fingerprint.slice(0, 6)}…`;
  }
}
