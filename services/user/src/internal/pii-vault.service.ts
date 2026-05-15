import { Inject, Injectable } from '@nestjs/common';
import { aesGcmDecrypt, aesGcmEncrypt } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { KEY_MANAGER, type KeyManager } from '../ports/key-manager.port.js';
import {
  PII_SCHEMA_VERSION,
  PiiV1Schema,
  type PiiV1,
} from '../pii.types.js';

export interface SealedPii {
  ciphertext: Buffer;
  nonce: Buffer;
  dataKeyCiphertext: Buffer;
  kekId: string;
  schemaVersion: number;
}

/** Single-string envelope version for the `sealOpaque` path. Bumped only
 *  if we change the envelope encoding (we keep the AAD scheme stable by
 *  including the AAD context fields in the envelope itself). */
export const OPAQUE_ENVELOPE_VERSION = 1 as const;

/**
 * Owns the lifecycle of encrypted PII payloads for ConsumerProfile, plus
 * arbitrary-secret envelopes for callers that need authenticated storage
 * of raw key material (e.g. outbound webhook signing secrets, partner
 * API keys held inside the platform).
 *
 * Structured path (seal/open) — for tables with dedicated columns per
 * envelope field (ConsumerProfile, BeneficialOwner):
 *   validate → fresh DEK from KeyManager → AES-256-GCM with AAD =
 *   `pii:{userId}:v{schema}` → return blob to persist.
 *
 * Opaque path (sealOpaque/openOpaque) — for tables that hold a single
 * `String` column (WebhookEndpoint.secretCiphertext, etc): identical
 * envelope, but the payload is opaque bytes and the AAD is supplied by
 * the caller as a context object. This keeps every secret bound to a
 * specific row + field so a ciphertext from one endpoint cannot be
 * replayed onto another, mirroring the pattern documented on
 * CredentialVaultService in services/lender.
 *
 * AAD binding is what makes this safe: tampering with the row id, the
 * field, or the schema version fails the GCM auth tag check rather than
 * silently decrypting to wrong-row plaintext.
 */
/**
 * SEC-019 — BeneficialOwner AAD versioning.
 *
 * Threat closed: pre-fix, every BO sealed blob was bound to the
 * merchant id only (via PiiVaultService.seal called with merchantId
 * cast through UserId). If a merchant had N beneficial owners, any
 * one of the N ciphertexts decrypted successfully against any one of
 * the N BO rows — because GCM auth-tag verification only checked the
 * merchant-bound AAD, which was identical for all N rows. An admin
 * (or compromised KMS key) could swap the SSN/DOB columns between
 * BOs of the same merchant and the ciphertext would still verify,
 * presenting wrong-person PII to the KYB call.
 *
 * Fix: bind AAD to the individual BeneficialOwner row id. Schema
 * version 2 uses `pii:bo:<beneficialOwnerId>:v2`; legacy rows stay
 * at version 1 and remain decryptable via the old merchant-bound
 * AAD by passing both merchantId and boId to the open call.
 */
export const BO_PII_SCHEMA_VERSION_V2 = 2 as const;

@Injectable()
export class PiiVaultService {
  constructor(@Inject(KEY_MANAGER) private readonly km: KeyManager) {}

  private aad(userId: UserId, schemaVersion: number): string {
    return `pii:${userId}:v${schemaVersion}`;
  }

  /** SEC-019 — BO-row-specific AAD. Always v2 — never used to write v1. */
  private boAad(beneficialOwnerId: string, schemaVersion: number): string {
    return `pii:bo:${beneficialOwnerId}:v${schemaVersion}`;
  }

  /** Deterministic AAD string from a context object. Keys are sorted so
   *  callers cannot accidentally produce a different AAD by ordering the
   *  same fields differently when re-opening. */
  private opaqueAad(aadContext: Record<string, string>): string {
    const keys = Object.keys(aadContext).sort();
    const parts = keys.map((k) => `${k}=${aadContext[k]}`);
    return `opaque:v${OPAQUE_ENVELOPE_VERSION}:${parts.join(':')}`;
  }

  async seal(userId: UserId, pii: PiiV1): Promise<SealedPii> {
    const validated = PiiV1Schema.parse(pii);
    const key = await this.km.generateDataKey();
    try {
      const enc = aesGcmEncrypt(
        Buffer.from(JSON.stringify(validated)),
        key.plaintext,
        this.aad(userId, PII_SCHEMA_VERSION),
      );
      return {
        ciphertext: enc.ciphertext,
        nonce: enc.nonce,
        dataKeyCiphertext: key.ciphertext,
        kekId: key.kekId,
        schemaVersion: PII_SCHEMA_VERSION,
      };
    } finally {
      key.plaintext.fill(0);
    }
  }

  async open(
    userId: UserId,
    sealed: {
      ciphertext: Buffer;
      nonce: Buffer;
      dataKeyCiphertext: Buffer;
      kekId: string;
      schemaVersion: number;
    },
  ): Promise<PiiV1> {
    const dek = await this.km.decryptDataKey({
      ciphertext: sealed.dataKeyCiphertext,
      kekId: sealed.kekId,
    });
    try {
      const plaintext = aesGcmDecrypt(
        { ciphertext: sealed.ciphertext, nonce: sealed.nonce },
        dek,
        this.aad(userId, sealed.schemaVersion),
      );
      const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
      return PiiV1Schema.parse(parsed);
    } finally {
      dek.fill(0);
    }
  }

  /**
   * SEC-019 — seal BeneficialOwner PII bound to the BO row id (not just
   * the merchant). Writes schemaVersion=2 envelopes; legacy v1 rows
   * sealed with the merchant-id AAD are migrated lazily via the
   * `openForBo()` path which switches on schemaVersion.
   *
   * Caller MUST pre-generate the BO id (via `randomUUID()`) and pass
   * the SAME id when persisting the row, otherwise the auth-tag check
   * on the next read will fail closed.
   */
  async sealForBo(
    beneficialOwnerId: string,
    pii: PiiV1,
  ): Promise<SealedPii> {
    const validated = PiiV1Schema.parse(pii);
    const key = await this.km.generateDataKey();
    try {
      const enc = aesGcmEncrypt(
        Buffer.from(JSON.stringify(validated)),
        key.plaintext,
        this.boAad(beneficialOwnerId, BO_PII_SCHEMA_VERSION_V2),
      );
      return {
        ciphertext: enc.ciphertext,
        nonce: enc.nonce,
        dataKeyCiphertext: key.ciphertext,
        kekId: key.kekId,
        schemaVersion: BO_PII_SCHEMA_VERSION_V2,
      };
    } finally {
      key.plaintext.fill(0);
    }
  }

  /**
   * SEC-019 — open BeneficialOwner PII. Auto-detects the AAD scheme
   * by inspecting the persisted schema version:
   *
   *   v1 (legacy)  → AAD = `pii:<merchantId>:v1` — pre-fix shape, all
   *                  BOs of the same merchant share an AAD, so any one
   *                  ciphertext is interchangeable on any one BO row.
   *   v2 (current) → AAD = `pii:bo:<beneficialOwnerId>:v2` — bound to
   *                  the individual row id, ciphertexts cannot be
   *                  swapped between rows.
   *
   * Caller passes both ids; we pick the right AAD by schemaVersion.
   * This keeps the migration zero-downtime — readers continue to open
   * legacy rows while new writes use v2.
   */
  async openForBo(
    beneficialOwnerId: string,
    merchantIdForLegacy: string,
    sealed: {
      ciphertext: Buffer;
      nonce: Buffer;
      dataKeyCiphertext: Buffer;
      kekId: string;
      schemaVersion: number;
    },
  ): Promise<PiiV1> {
    const dek = await this.km.decryptDataKey({
      ciphertext: sealed.dataKeyCiphertext,
      kekId: sealed.kekId,
    });
    try {
      const aad =
        sealed.schemaVersion >= BO_PII_SCHEMA_VERSION_V2
          ? this.boAad(beneficialOwnerId, sealed.schemaVersion)
          : // Legacy v1 — AAD was bound to the merchant id (cast
            // through UserId at the original callsite). Reproduce
            // that exact string so legacy ciphertexts still verify.
            this.aad(merchantIdForLegacy as UserId, sealed.schemaVersion);
      const plaintext = aesGcmDecrypt(
        { ciphertext: sealed.ciphertext, nonce: sealed.nonce },
        dek,
        aad,
      );
      const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
      return PiiV1Schema.parse(parsed);
    } finally {
      dek.fill(0);
    }
  }

  /**
   * Encrypt an arbitrary plaintext blob and return a single base64 string
   * suitable for a `String` column.
   *
   * `aadContext` is mixed into the GCM AAD so that a sealed blob cannot
   * be silently transplanted onto a different row. For example, the
   * outbound webhook dispatcher passes `{ scope: 'webhook_endpoint_secret',
   * endpointId }` — decryption then only succeeds when re-supplied with
   * the same endpointId at open time, so a ciphertext lifted from
   * endpoint A and written into endpoint B's row will fail authentication
   * and throw on read.
   *
   * Why base64 is NOT enough on its own: `Buffer.from(json).toString('base64')`
   * is reversible by anyone with read access to the row — it is encoding,
   * not encryption. Envelope encryption pairs a fresh per-row DEK with a
   * KEK held by the KMS (or LocalKeyManager in dev); the row alone is not
   * enough to recover the plaintext.
   */
  async sealOpaque(
    plaintext: Buffer | string,
    aadContext: Record<string, string>,
  ): Promise<string> {
    const aad = this.opaqueAad(aadContext);
    const key = await this.km.generateDataKey();
    try {
      const enc = aesGcmEncrypt(
        typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext,
        key.plaintext,
        aad,
      );
      // Single-line JSON envelope, then base64. The shape mirrors
      // SealedPii so future column-per-field migrations are mechanical.
      const envelope = {
        v: OPAQUE_ENVELOPE_VERSION,
        ct: enc.ciphertext.toString('base64'),
        n: enc.nonce.toString('base64'),
        dk: key.ciphertext.toString('base64'),
        k: key.kekId,
        aad: aadContext,
      };
      return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
    } finally {
      key.plaintext.fill(0);
    }
  }

  /**
   * Decrypt an opaque envelope produced by `sealOpaque`.
   *
   * The caller MUST pass the same `aadContext` it sealed with; mismatched
   * context causes GCM authentication to fail and `aesGcmDecrypt` throws.
   * That is the load-bearing property — it's what stops a row-level swap
   * from succeeding even when both rows belong to the same merchant.
   */
  async openOpaque(
    envelopeB64: string,
    aadContext: Record<string, string>,
  ): Promise<Buffer> {
    const aad = this.opaqueAad(aadContext);
    const parsed = JSON.parse(
      Buffer.from(envelopeB64, 'base64').toString('utf8'),
    ) as {
      v: number;
      ct: string;
      n: string;
      dk: string;
      k: string;
      aad?: Record<string, string>;
    };
    if (parsed.v !== OPAQUE_ENVELOPE_VERSION) {
      throw new Error(`unknown opaque envelope version ${parsed.v}`);
    }
    const dek = await this.km.decryptDataKey({
      ciphertext: Buffer.from(parsed.dk, 'base64'),
      kekId: parsed.k,
    });
    try {
      return aesGcmDecrypt(
        {
          ciphertext: Buffer.from(parsed.ct, 'base64'),
          nonce: Buffer.from(parsed.n, 'base64'),
        },
        dek,
        aad,
      );
    } finally {
      dek.fill(0);
    }
  }
}
