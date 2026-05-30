/**
 * Edge PII envelope-encryption primitive — partner-portal data layer.
 *
 * ─────────────────────────────────────────────────────────────────────
 * PRIV-002 (SOC 2 CC6.1 / GLBA Safeguards 16 CFR §314.4(c)(3))
 * ─────────────────────────────────────────────────────────────────────
 * The `applications` table on the partner-portal "edge" Postgres stored
 * consumer first/last/email/phone as plaintext `text`. The backend
 * `services/user` PII vault already encrypts the same class of data with
 * per-row AES-256-GCM envelope encryption (DEK wrapped by a KEK, AAD
 * binding, DEK zeroization). The edge table was the gap — strong vault
 * on one side, cleartext on the other.
 *
 * This module closes that gap by REUSING the exact same primitives the
 * backend vault uses — it invents NO new crypto scheme:
 *
 *   • AES-256-GCM via `aesGcmEncrypt` / `aesGcmDecrypt` from
 *     `@eazepay/shared-utils` (the same functions the backend
 *     `PiiVaultService` calls).
 *   • Envelope encryption via the `KeyManager` port from
 *     `@eazepay/integrations-core` — a fresh per-row DEK is generated,
 *     used once, then zeroized; the DEK ciphertext (wrapped by the KEK)
 *     is persisted next to the payload. The row alone is NOT enough to
 *     recover plaintext: an attacker also needs the KEK held by KMS (or
 *     the `LOCAL_KEK_HEX` in dev).
 *   • The single-string `sealOpaque` / `openOpaque` envelope shape,
 *     mirroring `services/user/src/internal/pii-vault.service.ts`, so the
 *     ciphertext lands in ONE `text` column per field and the schema
 *     change is purely additive.
 *
 * AAD BINDING — the load-bearing anti-transplant property
 * ------------------------------------------------------
 * Every ciphertext is bound, via the GCM Additional Authenticated Data,
 * to (a) a stable row identity — the application `id` — and (b) the
 * field name. Decryption only succeeds when re-supplied with the SAME
 * application id + field at open time. A ciphertext lifted from
 * application A's `consumer_email_enc` and written into application B's
 * row fails the GCM auth-tag check and THROWS on read — it cannot
 * silently decrypt to wrong-row plaintext. This is the same guarantee
 * SEC-019 added on the backend for BeneficialOwner rows.
 *
 * KEY MANAGER SELECTION (env, shared with apps/api)
 * -------------------------------------------------
 *   KEY_MANAGER=local    (default)  → LocalEdgeKeyManager, KEK from
 *                                     LOCAL_KEK_HEX (64 hex chars).
 *   KEY_MANAGER=mock-kms             → MockKmsKeyManager (rewrap-cutover
 *                                     parity; KEK from LOCAL_KEK_HEX or
 *                                     a fresh random KEK).
 *
 * The production AWS KMS adapter (`AwsKmsKeyManager`) drops in here once
 * the CMK ARN is provisioned — callers do not change because they depend
 * on the `KeyManager` port, not a concrete adapter. Until then the edge
 * uses the SAME `LOCAL_KEK_HEX` the backend `apps/api` vault uses, so
 * there is one KEK to rotate, not two.
 */

import { aesGcmDecrypt, aesGcmEncrypt, generateDataKey, sha256Hex } from '@eazepay/shared-utils';
import {
  MockKmsKeyManager,
  type DataKeyMaterial,
  type KeyManager,
} from '@eazepay/integrations-core';
import { createHmac } from 'node:crypto';

/** Envelope encoding version. Bump only if the on-disk JSON shape of a
 *  sealed value changes. The AAD context (application id + field) is
 *  carried in the AAD itself, so adding fields does NOT require a bump. */
export const EDGE_PII_ENVELOPE_VERSION = 1 as const;

/**
 * Dev / non-AWS-KMS KeyManager for the edge. Byte-for-byte compatible
 * with `services/user/src/adapters/local-key-manager.adapter.ts` — same
 * `dek:<kekId>` AAD on the DEK wrap, same `[nonce || ciphertext+tag]`
 * blob layout — so a DEK wrapped here is interchangeable with the
 * backend's local adapter. Reproduced here (rather than imported) only
 * because the backend adapter is a NestJS `@Injectable` and partner-portal
 * has no Nest DI container; the crypto is identical.
 */
class LocalEdgeKeyManager implements KeyManager {
  private readonly kek: Buffer;
  readonly kekId = 'local-dev';

  constructor(kekHex: string) {
    if (!kekHex || kekHex.length !== 64) {
      throw new Error(
        'LocalEdgeKeyManager requires a 32-byte (64 hex chars) KEK. ' +
          'Set LOCAL_KEK_HEX. Generate via: openssl rand -hex 32',
      );
    }
    this.kek = Buffer.from(kekHex, 'hex');
    if (this.kek.length !== 32) {
      throw new Error('LocalEdgeKeyManager KEK decoded to wrong byte length');
    }
  }

  async generateDataKey(): Promise<DataKeyMaterial> {
    const plaintext = generateDataKey();
    const enc = aesGcmEncrypt(plaintext, this.kek, `dek:${this.kekId}`);
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

  async wrapDataKey(plaintext: Buffer): Promise<Buffer> {
    if (plaintext.length !== 32) {
      throw new Error(
        `LocalEdgeKeyManager.wrapDataKey expects a 32-byte DEK; got ${plaintext.length}`,
      );
    }
    const enc = aesGcmEncrypt(plaintext, this.kek, `dek:${this.kekId}`);
    return Buffer.concat([enc.nonce, enc.ciphertext]);
  }
}

let cachedKeyManager: KeyManager | null = null;

/**
 * Resolve the process-wide edge KeyManager from env. Cached after first
 * construction (the KEK material does not change within a process).
 *
 * Throws loudly if the selected manager is misconfigured — a half-wired
 * crypto config must fail closed, never silently downgrade to plaintext.
 */
export function getEdgeKeyManager(): KeyManager {
  if (cachedKeyManager) return cachedKeyManager;
  const mode = process.env.KEY_MANAGER ?? 'local';
  const kekHex = process.env.LOCAL_KEK_HEX;

  if (mode === 'mock-kms') {
    // Rewrap-cutover parity path. Uses LOCAL_KEK_HEX when present so spec
    // runs / cutover dry-runs are reproducible; otherwise a fresh random
    // KEK (which is fine for the mock — it is not a persistence target).
    cachedKeyManager = new MockKmsKeyManager(kekHex ? { kekHex } : {});
    return cachedKeyManager;
  }
  if (mode === 'local') {
    if (!kekHex) {
      throw new Error(
        'Edge PII encryption requires LOCAL_KEK_HEX (64 hex chars) when KEY_MANAGER=local. ' +
          'This is the SAME KEK the apps/api vault uses. Generate via: openssl rand -hex 32',
      );
    }
    cachedKeyManager = new LocalEdgeKeyManager(kekHex);
    return cachedKeyManager;
  }
  throw new Error(
    `Unsupported KEY_MANAGER="${mode}" for edge PII encryption. ` +
      'Supported: "local" (LOCAL_KEK_HEX) or "mock-kms". ' +
      'AWS KMS adapter lands here once the CMK ARN is provisioned.',
  );
}

/** Test-only reset so specs can swap KEK material without a process restart. */
export function _resetEdgeKeyManager(): void {
  cachedKeyManager = null;
}

/**
 * Deterministic AAD string binding a ciphertext to one application row
 * + one field. Sorted, explicit `key=value` parts so a caller cannot
 * accidentally produce a different AAD by reordering. Mirrors
 * `PiiVaultService.opaqueAad`.
 */
function edgeAad(applicationId: string, field: string): string {
  return `edge_pii:v${EDGE_PII_ENVELOPE_VERSION}:application_id=${applicationId}:field=${field}`;
}

interface SealedEnvelope {
  v: number;
  ct: string; // base64 ciphertext+tag
  n: string; // base64 nonce
  dk: string; // base64 wrapped-DEK
  k: string; // kekId
  f: string; // field (echoed for debuggability; AAD is the source of truth)
}

/**
 * Encrypt one PII field value into a single base64 envelope string for a
 * `text` column. AAD is bound to (applicationId, field).
 *
 * The DEK is generated fresh per call, used once, then zeroized in the
 * `finally` — the plaintext key never lingers in the heap longer than
 * the encrypt call.
 */
export async function sealEdgePiiField(
  applicationId: string,
  field: string,
  plaintext: string,
): Promise<string> {
  const km = getEdgeKeyManager();
  const aad = edgeAad(applicationId, field);
  const key = await km.generateDataKey();
  try {
    const enc = aesGcmEncrypt(Buffer.from(plaintext, 'utf8'), key.plaintext, aad);
    const envelope: SealedEnvelope = {
      v: EDGE_PII_ENVELOPE_VERSION,
      ct: enc.ciphertext.toString('base64'),
      n: enc.nonce.toString('base64'),
      dk: key.ciphertext.toString('base64'),
      k: key.kekId,
      f: field,
    };
    return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
  } finally {
    key.plaintext.fill(0);
  }
}

/**
 * Decrypt an envelope produced by `sealEdgePiiField`. The caller MUST
 * pass the SAME applicationId + field it sealed with; a mismatch fails
 * the GCM auth tag and throws — this is what stops a cross-row transplant
 * from succeeding.
 */
export async function openEdgePiiField(
  applicationId: string,
  field: string,
  envelopeB64: string,
): Promise<string> {
  const km = getEdgeKeyManager();
  const aad = edgeAad(applicationId, field);
  const parsed = JSON.parse(Buffer.from(envelopeB64, 'base64').toString('utf8')) as SealedEnvelope;
  if (parsed.v !== EDGE_PII_ENVELOPE_VERSION) {
    throw new Error(`unknown edge PII envelope version ${parsed.v}`);
  }
  const dek = await km.decryptDataKey({
    ciphertext: Buffer.from(parsed.dk, 'base64'),
    kekId: parsed.k,
  });
  try {
    const plaintext = aesGcmDecrypt(
      {
        ciphertext: Buffer.from(parsed.ct, 'base64'),
        nonce: Buffer.from(parsed.n, 'base64'),
      },
      dek,
      aad,
    );
    return plaintext.toString('utf8');
  } finally {
    dek.fill(0);
  }
}

/**
 * Deterministic blind index for email equality lookup.
 *
 * WHY: AES-GCM is non-deterministic (fresh nonce per call), so
 * `WHERE consumer_email_enc = $1` can never match — two encryptions of
 * the same email produce different ciphertext. If a future feature needs
 * "find the application for this email" (dedupe, support lookup, RTBF by
 * email), it queries this HMAC column instead, which is stable for a
 * given normalized input.
 *
 * HMAC-SHA-256 (keyed) — NOT a bare hash — so an attacker who exfiltrates
 * the column cannot brute-force the (low-entropy) email space with a
 * rainbow table; they would also need `EDGE_PII_BLIND_INDEX_KEY`. The key
 * is DISTINCT from the encryption KEK: reusing a confidentiality key as a
 * MAC key is poor hygiene and couples two rotation lifecycles.
 *
 * The input is normalized (trim + lowercase) to match the write path,
 * which already lowercases email before persisting, so the index is
 * collision-correct for case-insensitive lookup.
 *
 * NOTE: this column is populated on write + backfill but NO query is
 * wired through it in this PR (there is no existing email equality lookup
 * to preserve — verified across the whole partner-portal). It exists so
 * the lookup can be added later WITHOUT another PII-touching migration.
 */
export function emailBlindIndex(email: string): string {
  const key = process.env.EDGE_PII_BLIND_INDEX_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'EDGE_PII_BLIND_INDEX_KEY (>=32 chars) is required to compute the email blind index. ' +
        'Generate via: openssl rand -hex 32. Must differ from LOCAL_KEK_HEX.',
    );
  }
  const normalized = email.trim().toLowerCase();
  return createHmac('sha256', key).update(normalized).digest('hex');
}

/** Stable fingerprint of an envelope, for audit/debug logging WITHOUT
 *  revealing plaintext. Not security-sensitive — just a correlation id. */
export function envelopeFingerprint(envelopeB64: string): string {
  return sha256Hex(envelopeB64).slice(0, 16);
}
