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

/**
 * Owns the lifecycle of encrypted PII payloads for ConsumerProfile.
 *
 * Seal: validate → fresh DEK from KeyManager → AES-256-GCM with AAD =
 * `pii:{userId}:v{schema}` → return blob to persist.
 *
 * Open: load DEK via KeyManager → AES-256-GCM verify with same AAD →
 * Zod-parse against the schema version recorded on the row.
 *
 * AAD binding ties ciphertext to the row's userId and schema version so
 * a swap of one user's blob into another row fails authentication.
 */
@Injectable()
export class PiiVaultService {
  constructor(@Inject(KEY_MANAGER) private readonly km: KeyManager) {}

  private aad(userId: UserId, schemaVersion: number): string {
    return `pii:${userId}:v${schemaVersion}`;
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
}
