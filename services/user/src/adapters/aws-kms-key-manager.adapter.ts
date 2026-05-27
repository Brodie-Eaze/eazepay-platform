import { Injectable, Logger } from '@nestjs/common';
import {
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  GetKeyRotationStatusCommand,
  type DescribeKeyCommandOutput,
  type KMSClient,
} from '@aws-sdk/client-kms';
import type { DataKeyMaterial, KeyManager } from '../ports/key-manager.port.js';

/**
 * Default KMS EncryptionContext baked into every GenerateDataKey /
 * Decrypt call. This is the KMS-level AAD — distinct from the AES-GCM
 * AAD that PiiVaultService binds to row ids. The KMS context binds the
 * DEK ciphertext to a tenant + purpose so a DEK blob stolen from this
 * platform cannot be replayed against a different KMS-using product
 * sharing the same KMS key alias (e.g. a future eazepay-mortgages
 * deployment) without also matching the context.
 *
 * Values are intentionally short, stable strings. KMS rejects context
 * keys/values containing newlines and limits each pair to 8KB; we stay
 * well inside those limits.
 */
export const DEFAULT_KMS_ENCRYPTION_CONTEXT: Readonly<Record<string, string>> = Object.freeze({
  tenant: 'eazepay',
  purpose: 'pii_envelope',
});

/**
 * Public DescribeKey metadata returned by ops/health-check probes.
 * Keep this shape stable; observability dashboards key off the field
 * names.
 */
export interface KmsKeyMetadata {
  readonly keyId: string;
  readonly keyState: string;
  readonly keySpec: string;
  readonly rotationEnabled: boolean;
}

/**
 * Wraps a raw AWS KMS SDK failure so callers can react without coupling
 * to `@aws-sdk/client-kms` internals. The `sdkErrorName` carries the
 * upstream `name` (e.g. `InvalidCiphertextException`,
 * `KMSInvalidStateException`, `AccessDeniedException`) so workers can
 * branch on it for retry / alert decisions without re-parsing the
 * underlying error.
 *
 * NEVER attach the raw SDK error as a property — its `$metadata` chain
 * can carry response headers / request IDs that are safe to log but
 * easy to leak into JSON responses by accident. Operators read the
 * structured log (`kms.<op>.err`) for the full SDK detail.
 */
export class KmsOperationError extends Error {
  readonly operation: 'generate_data_key' | 'decrypt' | 'describe_key';
  readonly sdkErrorName: string;
  readonly keyId: string | null;

  constructor(args: {
    operation: 'generate_data_key' | 'decrypt' | 'describe_key';
    sdkErrorName: string;
    message: string;
    keyId: string | null;
  }) {
    super(`[kms/${args.operation}] ${args.sdkErrorName}: ${args.message}`);
    this.name = 'KmsOperationError';
    this.operation = args.operation;
    this.sdkErrorName = args.sdkErrorName;
    this.keyId = args.keyId;
  }
}

export interface AwsKmsKeyManagerOptions {
  /** KMS key ARN or alias (e.g. `alias/eazepay-kek-prod`). */
  keyId: string;
  /** Injected KMS client. Construction is the caller's responsibility
   *  so tests can pass an `aws-sdk-client-mock` instance and prod can
   *  pass a real `new KMSClient({...})`. */
  client: KMSClient;
  /** Override the default KMS EncryptionContext (rare — only flip if
   *  this adapter is mounted in a non-pii_envelope context). */
  encryptionContext?: Record<string, string>;
}

/**
 * Production KeyManager backed by AWS KMS via envelope encryption.
 *
 *   plaintext  ─AES-GCM(DEK)─►  ciphertext
 *                  │
 *                  ▼
 *           KMS.GenerateDataKey → encrypted DEK (KMS-side ciphertext)
 *                                 stored beside the payload
 *
 * AuthN: relies on the AWS SDK default credential chain (ECS task role
 * in prod, env vars / shared config locally). The adapter NEVER reads
 * credential env vars directly — keeping that contract one layer away
 * means rotating the IAM role does not require a redeploy of this code.
 *
 * AuthZ: the KMS key policy must allow
 *   - `kms:GenerateDataKey` (write path)
 *   - `kms:Decrypt`         (read path)
 *   - `kms:DescribeKey`     (health probe)
 * scoped to the task role principal. EncryptionContext keys/values are
 * NOT secret but ARE part of the policy condition — see the IaC module
 * `infra/terraform/kms/` (to land in the matching infra PR).
 *
 * Idempotency: GenerateDataKey is naturally idempotent — every call
 * mints a fresh DEK. Decrypt is idempotent by construction. DescribeKey
 * is read-only. Retries are safe at every method on this adapter; the
 * AWS SDK applies its own exponential backoff for throttling.
 *
 * Tenant scoping: the KMS EncryptionContext carries `tenant=eazepay`
 * which prevents a DEK blob from this tenant being decryptable against
 * the same KMS key from a sibling-tenant deployment.
 */
@Injectable()
export class AwsKmsKeyManager implements KeyManager {
  /** Configured KMS key id (full ARN or alias). KMS may return a
   *  resolved-ARN on responses; the resolved form is what we persist
   *  on DataKeyMaterial.kekId, not this configured form. */
  readonly kekId: string;

  private readonly logger = new Logger(AwsKmsKeyManager.name);
  private readonly client: KMSClient;
  private readonly encryptionContext: Record<string, string>;

  constructor(opts: AwsKmsKeyManagerOptions) {
    if (!opts.keyId || opts.keyId.trim().length === 0) {
      throw new Error(
        'AwsKmsKeyManager requires a keyId (full KMS key ARN or alias like alias/eazepay-kek-prod).',
      );
    }
    this.kekId = opts.keyId;
    this.client = opts.client;
    this.encryptionContext = {
      ...DEFAULT_KMS_ENCRYPTION_CONTEXT,
      ...(opts.encryptionContext ?? {}),
    };
  }

  async generateDataKey(): Promise<DataKeyMaterial> {
    const start = Date.now();
    try {
      const out = await this.client.send(
        new GenerateDataKeyCommand({
          KeyId: this.kekId,
          KeySpec: 'AES_256',
          EncryptionContext: this.encryptionContext,
        }),
      );
      if (!out.Plaintext || !out.CiphertextBlob || !out.KeyId) {
        throw new KmsOperationError({
          operation: 'generate_data_key',
          sdkErrorName: 'MalformedResponse',
          message: 'GenerateDataKey response missing Plaintext, CiphertextBlob or KeyId.',
          keyId: this.kekId,
        });
      }
      const plaintext = Buffer.from(out.Plaintext);
      const ciphertext = Buffer.from(out.CiphertextBlob);
      // KMS may resolve aliases to the canonical key ARN. Persist that
      // resolved value so a later DescribeKey / Decrypt can compare.
      const resolvedKeyId = out.KeyId;
      this.logOk('generate_data_key', resolvedKeyId, Date.now() - start);
      return { plaintext, ciphertext, kekId: resolvedKeyId };
    } catch (err) {
      throw this.wrapAndLog('generate_data_key', err, this.kekId, Date.now() - start);
    }
  }

  async decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer> {
    const start = Date.now();
    try {
      const out = await this.client.send(
        new DecryptCommand({
          CiphertextBlob: input.ciphertext,
          // KMS does NOT require KeyId on a symmetric Decrypt — it
          // recovers the key from the ciphertext. We pass it anyway so
          // an attacker who swaps in a ciphertext from a different KMS
          // key gets a `IncorrectKeyException` instead of a successful
          // decrypt against whatever key the ciphertext came from.
          KeyId: input.kekId,
          EncryptionContext: this.encryptionContext,
        }),
      );
      if (!out.Plaintext || !out.KeyId) {
        throw new KmsOperationError({
          operation: 'decrypt',
          sdkErrorName: 'MalformedResponse',
          message: 'Decrypt response missing Plaintext or KeyId.',
          keyId: input.kekId,
        });
      }
      this.logOk('decrypt', out.KeyId, Date.now() - start);
      return Buffer.from(out.Plaintext);
    } catch (err) {
      throw this.wrapAndLog('decrypt', err, input.kekId, Date.now() - start);
    }
  }

  /**
   * Ops / health-check probe. Not on the KeyManager port (LocalKeyManager
   * has no notion of remote key metadata) — callers depending on this
   * must inject the concrete `AwsKmsKeyManager` token, not `KEY_MANAGER`.
   */
  async describeKey(keyId: string = this.kekId): Promise<KmsKeyMetadata> {
    const start = Date.now();
    try {
      const out: DescribeKeyCommandOutput = await this.client.send(
        new DescribeKeyCommand({ KeyId: keyId }),
      );
      const meta = out.KeyMetadata;
      if (!meta || !meta.KeyId || !meta.KeyState) {
        throw new KmsOperationError({
          operation: 'describe_key',
          sdkErrorName: 'MalformedResponse',
          message: 'DescribeKey response missing KeyMetadata.KeyId or KeyState.',
          keyId,
        });
      }
      // KMS reports rotation enable-state via a separate API; we fan
      // out a second call so the health probe surfaces ground truth
      // rather than a stub. AWS-managed (alias/aws/*) keys reject
      // GetKeyRotationStatus with AccessDenied — treat that as
      // `false` rather than failing the probe, since operators
      // cannot toggle rotation on AWS-managed keys anyway.
      let rotationEnabled = false;
      try {
        const rot = await this.client.send(new GetKeyRotationStatusCommand({ KeyId: meta.KeyId }));
        rotationEnabled = rot.KeyRotationEnabled === true;
      } catch (rotErr) {
        const name =
          rotErr && typeof rotErr === 'object' && 'name' in rotErr
            ? String((rotErr as { name: unknown }).name)
            : 'UnknownError';
        if (name !== 'AccessDeniedException' && name !== 'UnsupportedOperationException') {
          throw rotErr;
        }
      }
      const result: KmsKeyMetadata = {
        keyId: meta.KeyId,
        keyState: meta.KeyState,
        keySpec: meta.KeySpec ?? 'UNKNOWN',
        rotationEnabled,
      };
      this.logOk('describe_key', meta.KeyId, Date.now() - start);
      return result;
    } catch (err) {
      throw this.wrapAndLog('describe_key', err, keyId, Date.now() - start);
    }
  }

  private logOk(
    op: 'generate_data_key' | 'decrypt' | 'describe_key',
    keyId: string,
    latencyMs: number,
  ): void {
    // Structured JSON via Nest's Logger context. The audit pipeline
    // (pino redaction in apps/api) scrubs PII-style keys; this payload
    // contains none — KMS key IDs and latency are operator-readable.
    this.logger.log({ event: `kms.${op}.ok`, keyId, latencyMs });
  }

  private wrapAndLog(
    op: 'generate_data_key' | 'decrypt' | 'describe_key',
    err: unknown,
    keyId: string | null,
    latencyMs: number,
  ): KmsOperationError {
    if (err instanceof KmsOperationError) {
      this.logger.error({
        event: `kms.${op}.err`,
        keyId,
        latencyMs,
        sdkErrorName: err.sdkErrorName,
        message: err.message,
      });
      return err;
    }
    // SDK errors have `.name` (e.g. InvalidCiphertextException) and
    // `.message`. We never re-export the SDK error object — its
    // $metadata can carry request IDs that we log here but should
    // not appear in caller-visible exception properties.
    const sdkErrorName =
      err && typeof err === 'object' && 'name' in err && typeof err.name === 'string'
        ? err.name
        : 'UnknownError';
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'KMS call failed';
    this.logger.error({
      event: `kms.${op}.err`,
      keyId,
      latencyMs,
      sdkErrorName,
      message,
    });
    return new KmsOperationError({ operation: op, sdkErrorName, message, keyId });
  }
}
