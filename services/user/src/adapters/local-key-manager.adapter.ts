import { Injectable, Logger } from '@nestjs/common';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateDataKey,
} from '@eazepay/shared-utils';
import type {
  DataKeyMaterial,
  KeyManager,
} from '../ports/key-manager.port.js';

/**
 * Dev / non-AWS-KMS path. The KEK is loaded from env (32 bytes hex).
 * Encrypted DEKs are produced by AES-256-GCM under the KEK with a static
 * AAD that includes the kekId — this is structurally identical to what
 * KMS does on the wire and lets us swap to KmsKeyManagerAdapter later
 * without changing any callers.
 *
 * Hard guard: refuses to construct if the KEK is missing or wrong length.
 */
@Injectable()
export class LocalKeyManager implements KeyManager {
  private readonly logger = new Logger(LocalKeyManager.name);
  private readonly kek: Buffer;
  readonly kekId = 'local-dev';

  constructor(kekHex: string) {
    if (!kekHex || kekHex.length !== 64) {
      throw new Error(
        'LocalKeyManager requires a 32-byte (64 hex chars) KEK. Generate via: openssl rand -hex 32',
      );
    }
    this.kek = Buffer.from(kekHex, 'hex');
    if (this.kek.length !== 32) {
      throw new Error('LocalKeyManager KEK decoded to wrong byte length');
    }
  }

  async generateDataKey(): Promise<DataKeyMaterial> {
    const plaintext = generateDataKey();
    const enc = aesGcmEncrypt(plaintext, this.kek, `dek:${this.kekId}`);
    // Store [nonce || ciphertext+tag] as a single opaque blob.
    const ciphertext = Buffer.concat([enc.nonce, enc.ciphertext]);
    return { plaintext, ciphertext, kekId: this.kekId };
  }

  async decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer> {
    if (input.kekId !== this.kekId) {
      throw new Error(`KEK mismatch: stored ${input.kekId}, runtime ${this.kekId}`);
    }
    const nonce = input.ciphertext.subarray(0, 12);
    const ciphertext = input.ciphertext.subarray(12);
    return aesGcmDecrypt({ ciphertext, nonce }, this.kek, `dek:${this.kekId}`);
  }
}
