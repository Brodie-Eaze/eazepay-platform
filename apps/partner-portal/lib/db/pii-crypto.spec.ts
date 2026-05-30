/**
 * PRIV-002 — edge PII envelope-encryption tests.
 *
 * Proves the three properties an auditor cares about:
 *   1. Round-trip: seal → open returns the original plaintext.
 *   2. AAD binding: a ciphertext sealed for application A FAILS to open
 *      under application B's id (cross-row transplant rejected).
 *   3. Backfill correctness: sealApplicationPii → decryptApplicationRow
 *      reproduces the input (with the email lowercased exactly as the
 *      write path + blind index normalize it).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  _resetEdgeKeyManager,
  emailBlindIndex,
  openEdgePiiField,
  sealEdgePiiField,
} from './pii-crypto';
import { decryptApplicationRow, sealApplicationPii, EDGE_PII_FIELDS } from './applications-pii';

// Deterministic dev KEK + blind-index key for hermetic runs.
const KEK_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const BIDX_KEY = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

beforeEach(() => {
  process.env.KEY_MANAGER = 'local';
  process.env.LOCAL_KEK_HEX = KEK_HEX;
  process.env.EDGE_PII_BLIND_INDEX_KEY = BIDX_KEY;
  _resetEdgeKeyManager();
});

afterEach(() => {
  _resetEdgeKeyManager();
});

describe('sealEdgePiiField / openEdgePiiField', () => {
  it('round-trips a single field bound to an application id', async () => {
    const appId = randomUUID();
    const sealed = await sealEdgePiiField(appId, EDGE_PII_FIELDS.email, 'jane@example.com');
    // Ciphertext is opaque base64, not the plaintext.
    expect(sealed).not.toContain('jane@example.com');
    const opened = await openEdgePiiField(appId, EDGE_PII_FIELDS.email, sealed);
    expect(opened).toBe('jane@example.com');
  });

  it('produces different ciphertext each call (fresh DEK + nonce)', async () => {
    const appId = randomUUID();
    const a = await sealEdgePiiField(appId, EDGE_PII_FIELDS.first, 'Jane');
    const b = await sealEdgePiiField(appId, EDGE_PII_FIELDS.first, 'Jane');
    expect(a).not.toBe(b); // non-deterministic encryption
    expect(await openEdgePiiField(appId, EDGE_PII_FIELDS.first, a)).toBe('Jane');
    expect(await openEdgePiiField(appId, EDGE_PII_FIELDS.first, b)).toBe('Jane');
  });

  it('REJECTS a ciphertext transplanted to a different application id (AAD)', async () => {
    const appA = randomUUID();
    const appB = randomUUID();
    const sealedForA = await sealEdgePiiField(appA, EDGE_PII_FIELDS.email, 'victim@example.com');
    // Lifting A's ciphertext onto B's row must fail the GCM auth tag.
    await expect(openEdgePiiField(appB, EDGE_PII_FIELDS.email, sealedForA)).rejects.toThrow();
  });

  it('REJECTS a ciphertext opened under the wrong field name (AAD)', async () => {
    const appId = randomUUID();
    const sealedAsEmail = await sealEdgePiiField(appId, EDGE_PII_FIELDS.email, 'x@example.com');
    await expect(openEdgePiiField(appId, EDGE_PII_FIELDS.phone, sealedAsEmail)).rejects.toThrow();
  });
});

describe('emailBlindIndex', () => {
  it('is deterministic and case/space-insensitive', () => {
    const a = emailBlindIndex('Jane@Example.com');
    const b = emailBlindIndex('  jane@example.com ');
    expect(a).toBe(b);
  });

  it('differs for different emails', () => {
    expect(emailBlindIndex('a@example.com')).not.toBe(emailBlindIndex('b@example.com'));
  });

  it('changes when the HMAC key changes (keyed, not a bare hash)', () => {
    const withKey1 = emailBlindIndex('jane@example.com');
    process.env.EDGE_PII_BLIND_INDEX_KEY =
      '1122334455667788112233445566778811223344556677881122334455667788';
    const withKey2 = emailBlindIndex('jane@example.com');
    expect(withKey1).not.toBe(withKey2);
  });

  it('throws when the blind-index key is missing', () => {
    delete process.env.EDGE_PII_BLIND_INDEX_KEY;
    expect(() => emailBlindIndex('jane@example.com')).toThrow(/EDGE_PII_BLIND_INDEX_KEY/);
  });
});

describe('sealApplicationPii / decryptApplicationRow (write + read boundary)', () => {
  it('round-trips all four fields and lowercases email', async () => {
    const appId = randomUUID();
    const sealed = await sealApplicationPii(appId, {
      consumerFirst: 'Jane',
      consumerLast: 'Doe',
      consumerEmail: 'Jane.DOE@Example.com',
      consumerPhone: '5551234567',
    });
    // Simulate the persisted row, then decrypt as the read path does.
    const pii = await decryptApplicationRow({
      id: appId,
      consumerFirstEnc: sealed.consumerFirstEnc,
      consumerLastEnc: sealed.consumerLastEnc,
      consumerEmailEnc: sealed.consumerEmailEnc,
      consumerPhoneEnc: sealed.consumerPhoneEnc,
    });
    expect(pii).toEqual({
      consumerFirst: 'Jane',
      consumerLast: 'Doe',
      consumerEmail: 'jane.doe@example.com', // normalized
      consumerPhone: '5551234567',
    });
    // Blind index matches the normalized email.
    expect(sealed.consumerEmailBidx).toBe(emailBlindIndex('jane.doe@example.com'));
  });

  it('decryptApplicationRow throws on a NULL ciphertext column (fail-closed)', async () => {
    const appId = randomUUID();
    await expect(
      decryptApplicationRow({
        id: appId,
        consumerFirstEnc: null,
        consumerLastEnc: 'x',
        consumerEmailEnc: 'x',
        consumerPhoneEnc: 'x',
      }),
    ).rejects.toThrow(/NULL encrypted PII column/);
  });

  it('rejects an application row whose ciphertext came from a DIFFERENT row id', async () => {
    const appA = randomUUID();
    const appB = randomUUID();
    const sealedA = await sealApplicationPii(appA, {
      consumerFirst: 'Jane',
      consumerLast: 'Doe',
      consumerEmail: 'jane@example.com',
      consumerPhone: '5551234567',
    });
    // Persist A's ciphertext but claim it's row B → must throw on decrypt.
    await expect(
      decryptApplicationRow({
        id: appB,
        consumerFirstEnc: sealedA.consumerFirstEnc,
        consumerLastEnc: sealedA.consumerLastEnc,
        consumerEmailEnc: sealedA.consumerEmailEnc,
        consumerPhoneEnc: sealedA.consumerPhoneEnc,
      }),
    ).rejects.toThrow();
  });
});

describe('backfill seal/decrypt parity (scripts/backfill-priv002)', () => {
  it('encrypting a historical plaintext row then decrypting reproduces it', async () => {
    // Mirrors exactly what scripts/backfill-priv002.ts does per row:
    // read plaintext → sealApplicationPii(id, …) → store _enc → later
    // decryptApplicationRow(row) on the read path.
    const id = randomUUID();
    const legacyPlaintext = {
      consumerFirst: 'Carlos',
      consumerLast: 'Ng',
      consumerEmail: 'CARLOS.NG@host.example',
      consumerPhone: '4155550199',
    };
    const sealed = await sealApplicationPii(id, legacyPlaintext);
    const decrypted = await decryptApplicationRow({
      id,
      consumerFirstEnc: sealed.consumerFirstEnc,
      consumerLastEnc: sealed.consumerLastEnc,
      consumerEmailEnc: sealed.consumerEmailEnc,
      consumerPhoneEnc: sealed.consumerPhoneEnc,
    });
    expect(decrypted.consumerFirst).toBe('Carlos');
    expect(decrypted.consumerLast).toBe('Ng');
    expect(decrypted.consumerEmail).toBe('carlos.ng@host.example');
    expect(decrypted.consumerPhone).toBe('4155550199');
  });

  it('mock-kms key manager also round-trips (cutover parity path)', async () => {
    process.env.KEY_MANAGER = 'mock-kms';
    _resetEdgeKeyManager();
    const id = randomUUID();
    const sealed = await sealApplicationPii(id, {
      consumerFirst: 'A',
      consumerLast: 'B',
      consumerEmail: 'a.b@example.com',
      consumerPhone: '5550000000',
    });
    const pii = await decryptApplicationRow({
      id,
      consumerFirstEnc: sealed.consumerFirstEnc,
      consumerLastEnc: sealed.consumerLastEnc,
      consumerEmailEnc: sealed.consumerEmailEnc,
      consumerPhoneEnc: sealed.consumerPhoneEnc,
    });
    expect(pii.consumerEmail).toBe('a.b@example.com');
  });
});
