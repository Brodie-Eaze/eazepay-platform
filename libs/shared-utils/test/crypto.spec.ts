import { describe, expect, it } from 'vitest';
import { aesGcmDecrypt, aesGcmEncrypt, generateDataKey } from '../src/crypto.js';
import { sha256Hex, stableJsonSha256 } from '../src/hash.js';

describe('AES-256-GCM', () => {
  it('round-trips with AAD', () => {
    const key = generateDataKey();
    const aad = 'pii:user-123:v1';
    const enc = aesGcmEncrypt(Buffer.from('hello world'), key, aad);
    const dec = aesGcmDecrypt(enc, key, aad);
    expect(dec.toString()).toBe('hello world');
  });

  it('fails with wrong AAD', () => {
    const key = generateDataKey();
    const enc = aesGcmEncrypt(Buffer.from('secret'), key, 'aad-1');
    expect(() => aesGcmDecrypt(enc, key, 'aad-2')).toThrow();
  });

  it('rejects non-32-byte key', () => {
    expect(() => aesGcmEncrypt(Buffer.from('x'), Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});

describe('hash helpers', () => {
  it('sha256Hex is deterministic', () => {
    expect(sha256Hex('a')).toBe(sha256Hex('a'));
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('stableJsonSha256 ignores key order', () => {
    expect(stableJsonSha256({ a: 1, b: 2 })).toBe(stableJsonSha256({ b: 2, a: 1 }));
  });

  it('stableJsonSha256 changes when values change', () => {
    expect(stableJsonSha256({ a: 1 })).not.toBe(stableJsonSha256({ a: 2 }));
  });
});
