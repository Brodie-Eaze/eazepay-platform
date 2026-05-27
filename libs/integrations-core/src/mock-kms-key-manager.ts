/**
 * MockKmsKeyManager — destination-side KeyManager for the DEK-rewrap
 * cutover script BEFORE the real AWS KMS adapter ships.
 *
 * Why this exists separately from `LocalKeyManager` in services/user:
 *   1. It carries a distinct `kekId` (default `mock-kms`) so the rewrap
 *      script's idempotency check ("already on destination KEK?") can
 *      actually skip already-rewrapped rows.
 *   2. It lives in `@eazepay/integrations-core` — a zero-NestJS-deps
 *      port lib — so the script can construct it without dragging in
 *      the full UserModule wiring.
 *   3. It is the smallest possible stand-in for AWS KMS: a fresh
 *      32-byte KEK + the AES-256-GCM wrap/unwrap pair, with the same
 *      AAD scheme (`dek:<kekId>`) that the production adapter will
 *      use when KMS replaces it.
 *
 * Test fixtures construct it with a deterministic kekHex so spec runs
 * are reproducible; the migration script in dry-run / mock-cutover
 * mode constructs it with a random 32-byte KEK at process start.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DataKeyMaterial, KeyManager } from './key-manager.js';

const ALGO = 'aes-256-gcm' as const;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface MockKmsKeyManagerOptions {
  /** Hex-encoded 32-byte KEK. If omitted, a fresh random KEK is minted.
   *  Tests pass an explicit value for reproducibility. */
  kekHex?: string;
  /** KEK identifier persisted on rewrapped rows. Defaults to `mock-kms`
   *  so a quick `SELECT count(*) WHERE kek_id = 'mock-kms'` proves the
   *  rewrap landed. Production replaces this with the KMS key ARN. */
  kekId?: string;
}

export class MockKmsKeyManager implements KeyManager {
  private readonly kek: Buffer;
  readonly kekId: string;

  constructor(options: MockKmsKeyManagerOptions = {}) {
    if (options.kekHex) {
      if (options.kekHex.length !== 64) {
        throw new Error(
          'MockKmsKeyManager kekHex must be 64 hex chars (32 bytes). Generate via: openssl rand -hex 32',
        );
      }
      this.kek = Buffer.from(options.kekHex, 'hex');
      if (this.kek.length !== KEY_BYTES) {
        throw new Error('MockKmsKeyManager KEK decoded to wrong byte length');
      }
    } else {
      this.kek = randomBytes(KEY_BYTES);
    }
    this.kekId = options.kekId ?? 'mock-kms';
  }

  async generateDataKey(): Promise<DataKeyMaterial> {
    const plaintext = randomBytes(KEY_BYTES);
    const ciphertext = this.wrapPlaintextSync(plaintext);
    return { plaintext, ciphertext, kekId: this.kekId };
  }

  async wrapDataKey(plaintext: Buffer): Promise<Buffer> {
    if (plaintext.length !== KEY_BYTES) {
      throw new Error(
        `MockKmsKeyManager.wrapDataKey expects a 32-byte DEK; got ${plaintext.length}`,
      );
    }
    return this.wrapPlaintextSync(plaintext);
  }

  async decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer> {
    if (input.kekId !== this.kekId) {
      throw new Error(
        `KEK mismatch: stored ${input.kekId}, runtime ${this.kekId} (MockKmsKeyManager)`,
      );
    }
    if (input.ciphertext.length < NONCE_BYTES + TAG_BYTES) {
      throw new Error('MockKmsKeyManager ciphertext too short');
    }
    const nonce = input.ciphertext.subarray(0, NONCE_BYTES);
    const body = input.ciphertext.subarray(NONCE_BYTES);
    const tagStart = body.length - TAG_BYTES;
    const enc = body.subarray(0, tagStart);
    const tag = body.subarray(tagStart);
    const decipher = createDecipheriv(ALGO, this.kek, nonce);
    decipher.setAAD(Buffer.from(`dek:${this.kekId}`));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  private wrapPlaintextSync(plaintext: Buffer): Buffer {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGO, this.kek, nonce);
    cipher.setAAD(Buffer.from(`dek:${this.kekId}`));
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout matches LocalKeyManager: [nonce(12) || ciphertext || tag(16)]
    return Buffer.concat([nonce, enc, tag]);
  }
}
