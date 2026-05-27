/**
 * KeyManager — vendor-agnostic envelope-encryption port.
 *
 * Shape parity with `services/user/src/ports/key-manager.port.ts`.
 * The shape is repeated here (rather than imported) so adapters that
 * live outside the user service — e.g. the AWS KMS adapter, future
 * GCP/Azure KMS adapters, and the DEK-rewrap migration script — depend
 * on `@eazepay/integrations-core` (a zero-runtime-dep port lib) rather
 * than reaching into a NestJS service module.
 *
 * Production target: a thin wrapper around AWS KMS `GenerateDataKey`
 * + `Decrypt` lives at `libs/integrations-core/src/aws-kms-key-manager.ts`
 * once the AWS account + CMK ARN are provisioned (Day 6 of the cutover).
 * Until then, callers can use `MockKmsKeyManager` to exercise the full
 * end-to-end DEK-rewrap path against a fresh KEK that is structurally
 * distinct from the LocalKeyManager `local-dev` KEK.
 *
 * INVARIANTS — adapters MUST hold these or the rewrap script breaks:
 *   1. `generateDataKey()` returns a 32-byte plaintext DEK (AES-256-GCM
 *      key length) and an opaque ciphertext blob the KMS can later
 *      decrypt back to the SAME 32 bytes.
 *   2. `decryptDataKey({ ciphertext, kekId })` rejects when `kekId`
 *      does not match the adapter's KEK identifier — this is the
 *      load-bearing rotation guard, equivalent to KMS's own
 *      `IncorrectKeyException` path.
 *   3. Adapters never persist the plaintext DEK — callers `.fill(0)`
 *      it after use.
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
  /** Identifier of the KEK this adapter wraps DEKs under. Used by the
   *  rewrap script for the idempotency check ("am I already on the
   *  destination KEK?") and by audit-log writers. */
  readonly kekId: string;

  /** Generate a fresh DEK. Caller encrypts payload with `plaintext` and
   *  stores `ciphertext` + `kekId` next to the row. */
  generateDataKey(): Promise<DataKeyMaterial>;

  /** Decrypt a previously-stored DEK ciphertext back to its 32-byte
   *  plaintext. Throws on KEK mismatch or auth-tag failure — both are
   *  unrecoverable and indicate either a configuration error or a
   *  tamper attempt. */
  decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer>;

  /** Re-wrap an already-decrypted DEK under THIS adapter's KEK. Returns
   *  the new ciphertext blob; the kekId of the result is `this.kekId`.
   *
   *  This is the rewrap-migration primitive — it skips the
   *  `generateDataKey` round-trip when we already hold the plaintext
   *  DEK from the source KEK's `decryptDataKey` call. AWS KMS exposes
   *  this as `Encrypt`; the local + mock adapters reproduce the same
   *  shape. */
  wrapDataKey(plaintext: Buffer): Promise<Buffer>;
}

export const KEY_MANAGER = Symbol('KEY_MANAGER');
