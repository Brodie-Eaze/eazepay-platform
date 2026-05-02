import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm' as const;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface AesGcmCiphertext {
  /** Concatenation of [ciphertext || authTag]. */
  ciphertext: Buffer;
  nonce: Buffer;
}

/**
 * AES-256-GCM authenticated encryption.
 * - 12-byte random nonce per call.
 * - 16-byte authentication tag appended to ciphertext.
 * - Optional Additional Authenticated Data (AAD) — typically a stable
 *   identifier like `${entity}:${id}:${schemaVersion}` to bind ciphertext
 *   to its row and detect cross-row swaps.
 *
 * Throws if the key length is not 32 bytes.
 */
export const aesGcmEncrypt = (
  plaintext: Buffer | string,
  key: Buffer,
  aad?: Buffer | string,
): AesGcmCiphertext => {
  if (key.length !== KEY_BYTES) {
    throw new Error(`AES-256-GCM key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([
    cipher.update(typeof plaintext === 'string' ? Buffer.from(plaintext) : plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce };
};

export const aesGcmDecrypt = (
  input: AesGcmCiphertext,
  key: Buffer,
  aad?: Buffer | string,
): Buffer => {
  if (key.length !== KEY_BYTES) {
    throw new Error(`AES-256-GCM key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  if (input.ciphertext.length < TAG_BYTES) {
    throw new Error('ciphertext too short to contain auth tag');
  }
  const tagStart = input.ciphertext.length - TAG_BYTES;
  const enc = input.ciphertext.subarray(0, tagStart);
  const tag = input.ciphertext.subarray(tagStart);
  const decipher = createDecipheriv(ALGO, key, input.nonce);
  if (aad !== undefined) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
};

export const generateDataKey = (): Buffer => randomBytes(KEY_BYTES);
