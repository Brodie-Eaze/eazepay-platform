import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { DataKeyMaterial, KeyManager } from '../ports/key-manager.port.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * KMS KeyManager — STUB ADAPTER (real AWS KMS wiring deferred to infra).
 * ─────────────────────────────────────────────────────────────────────
 *
 * Why this exists:
 *   Production must boot with `KEY_MANAGER=kms` so the dispatch path in
 *   UserModule.forRoot resolves to a KMS-backed adapter rather than the
 *   LocalKeyManager (whose KEK sits on disk / in env, a SOC2 finding).
 *   Pre-fix, the dispatch path threw `KMS KeyManager not yet implemented`
 *   and production silently fell back to LocalKeyManager via the env
 *   default. This stub closes the dispatch hole — the env-driven
 *   selection now resolves to a real class — while the actual AWS KMS
 *   GenerateDataKey + Decrypt calls land in a separate infra task.
 *
 * What this is NOT:
 *   - Not a production-ready KMS client. Do not ship to a tenant.
 *   - Not a substitute for `LocalKeyManager` in dev — LocalKeyManager
 *     produces deterministic ciphertext that round-trips with the
 *     real envelope encryption scheme; this stub does not.
 *
 * What this IS:
 *   - A class that conforms to the `KeyManager` port so the DI swap
 *     mechanism is exercised end-to-end.
 *   - It produces a fresh 32-byte random DEK on every call. The
 *     "ciphertext" returned is a placeholder (also random) — opening
 *     it will fail because the stub `decryptDataKey` throws. This is
 *     deliberate: any code path that round-trips a stub-produced
 *     envelope MUST fail loudly so we don't accidentally persist
 *     undecryptable data in production.
 *
 * Replacement plan (infra task):
 *   1. Add @aws-sdk/client-kms dependency.
 *   2. Inject `KMSClient` (constructed in apps/api boot from env:
 *      `KMS_KEY_ARN`, `AWS_REGION`).
 *   3. `generateDataKey()` calls `GenerateDataKeyCommand` with
 *      `KeySpec: 'AES_256'` and returns `{ plaintext: Plaintext,
 *      ciphertext: CiphertextBlob, kekId: this.kekArn }`.
 *   4. `decryptDataKey()` calls `DecryptCommand` with `KeyId: kekId`
 *      and an `EncryptionContext` that mirrors the AAD scheme used
 *      by `LocalKeyManager` (so envelopes are not interchangeable
 *      across adapters by design).
 *   5. Wire CloudTrail on the KMS key so every Decrypt is logged.
 *   6. Remove the `safeLog.warn({event:'kek.kms_adapter_stub'})` call
 *      in this file as the final step.
 *
 * Compliance trail:
 *   - SOC2 CC6.1 / CC6.7 (logical access + transmission protection)
 *   - PCI DSS 3.5, 3.6 (key management lifecycle)
 *   - Runbook: docs/runbooks/kek-rotation.md
 */
@Injectable()
export class KmsKeyManager implements KeyManager {
  private readonly logger = new Logger(KmsKeyManager.name);
  /** Placeholder KEK id. Replaced with the KMS key ARN once the infra
   *  task wires the real client. */
  readonly kekId = 'kms-stub:not-wired';

  constructor() {
    // safeLog-shaped structured warn so the alert pipeline (Datadog
    // log monitor on `event:kek.kms_adapter_stub`) can fire if this
    // ever runs outside a dev sanity check.
    this.logger.warn({
      event: 'kek.kms_adapter_stub',
      message:
        'KmsKeyManager stub constructed — real AWS KMS client not wired. ' +
        'Any envelope produced here will NOT round-trip. See ' +
        'docs/runbooks/kek-rotation.md.',
    });
  }

  async generateDataKey(): Promise<DataKeyMaterial> {
    // Real impl: KMSClient.send(new GenerateDataKeyCommand(...))
    this.logger.warn({
      event: 'kek.kms_adapter_stub',
      op: 'generateDataKey',
      message: 'stub returning random bytes; ciphertext is non-decryptable',
    });
    const plaintext = randomBytes(32);
    // Random placeholder for the encrypted-DEK blob. Real KMS returns
    // an opaque CiphertextBlob; we mirror the shape (32 bytes) so any
    // schema-level length check still passes during dev tests.
    const ciphertext = randomBytes(32);
    return { plaintext, ciphertext, kekId: this.kekId };
  }

  async decryptDataKey(_input: { ciphertext: Buffer; kekId: string }): Promise<Buffer> {
    // Fail loudly — see class docstring. Any caller that hits this in
    // production has a real bug (e.g. a row encrypted under the stub
    // got persisted) and we want the failure visible in the trace.
    this.logger.warn({
      event: 'kek.kms_adapter_stub',
      op: 'decryptDataKey',
      message: 'stub decrypt invoked — refusing to fabricate plaintext',
    });
    throw new Error(
      'KmsKeyManager is a stub; real AWS KMS Decrypt is not wired. ' +
        'Refusing to return fabricated plaintext. See docs/runbooks/kek-rotation.md.',
    );
  }
}
