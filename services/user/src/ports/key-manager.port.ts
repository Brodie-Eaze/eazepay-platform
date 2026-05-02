/**
 * KeyManager — abstraction over KMS-style envelope encryption.
 *
 *   plaintext  ─encrypt(DEK)─►  ciphertext
 *                  │
 *                  ▼
 *           encrypted DEK  (stored beside ciphertext)
 *
 * Production adapter wraps AWS KMS (`GenerateDataKey` + `Decrypt`). Dev
 * adapter wraps a 32-byte KEK loaded from env. Both implementations
 * return raw 32-byte data keys for AES-256-GCM use; callers are
 * responsible for zeroing them when done.
 */
export interface DataKeyMaterial {
  /** 32-byte plaintext DEK — never persisted. */
  plaintext: Buffer;
  /** Opaque ciphertext blob to persist beside the encrypted payload. */
  ciphertext: Buffer;
  /** Identifier of the KEK used (KMS key ARN, or 'local-dev'). */
  kekId: string;
}

export interface KeyManager {
  /** Generate a fresh DEK. Caller encrypts payload with `plaintext` and
   *  stores `ciphertext` + `kekId` next to the row. */
  generateDataKey(): Promise<DataKeyMaterial>;

  /** Decrypt a previously-stored DEK ciphertext back to its 32-byte plaintext. */
  decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer>;
}

export const KEY_MANAGER = Symbol('KEY_MANAGER');
