// Characterization tests for PiiVaultService.
//
// These tests pin the CURRENT behaviour — they are the oracle for the
// rewrite, not a wish list. Where the legacy code does something the
// spec arguably disagrees with, the test asserts what the code DOES
// and we flag the discrepancy in code comments rather than failing the
// build.
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PiiVaultService } from '../src/internal/pii-vault.service.js';
import { LocalKeyManager } from '../src/adapters/local-key-manager.adapter.js';
import { PII_SCHEMA_VERSION } from '../src/pii.types.js';
import { KEK_HEX, makeVault, samplePii } from './_helpers.js';

describe('PiiVaultService — structured seal/open round-trip', () => {
  it('round-trips PiiV1 for the same userId', async () => {
    const vault = makeVault();
    const userId = 'user-alpha';
    const pii = samplePii();
    const sealed = await vault.seal(userId as any, pii);
    expect(sealed.schemaVersion).toBe(PII_SCHEMA_VERSION);
    expect(sealed.kekId).toBe('local-dev');
    expect(sealed.ciphertext.length).toBeGreaterThan(0);
    expect(sealed.nonce.length).toBe(12);
    const opened = await vault.open(userId as any, sealed);
    expect(opened).toEqual(pii);
  });

  it('SEC-019: rejects swap-attack — user-A ciphertext opened as user-B fails the GCM auth tag', async () => {
    const vault = makeVault();
    const userA = 'user-A';
    const userB = 'user-B';
    const sealedForA = await vault.seal(userA as any, samplePii());
    // Same ciphertext + same DEK envelope, but the open() call uses
    // user-B as the AAD context. Auth-tag verification must fail.
    await expect(vault.open(userB as any, sealedForA)).rejects.toThrow();
  });

  it('rejects ciphertext tampering even with the right userId', async () => {
    const vault = makeVault();
    const userId = 'user-alpha';
    const sealed = await vault.seal(userId as any, samplePii());
    const tampered = {
      ...sealed,
      ciphertext: Buffer.concat([
        sealed.ciphertext.subarray(0, sealed.ciphertext.length - 1),
        Buffer.from([0x00]),
      ]),
    };
    await expect(vault.open(userId as any, tampered)).rejects.toThrow();
  });

  it('rejects bumping the schemaVersion after the fact (AAD includes version)', async () => {
    const vault = makeVault();
    const userId = 'user-alpha';
    const sealed = await vault.seal(userId as any, samplePii());
    await expect(
      vault.open(userId as any, { ...sealed, schemaVersion: sealed.schemaVersion + 1 }),
    ).rejects.toThrow();
  });

  it('Zod validation: seal rejects bad PII shape (invalid DOB regex)', async () => {
    const vault = makeVault();
    const bad = samplePii({ dateOfBirth: 'not-a-date' as any });
    await expect(vault.seal('user-x' as any, bad)).rejects.toThrow();
  });
});

describe('PiiVaultService — sealForBo / openForBo (SEC-019 v2 AAD)', () => {
  it('v2 seal binds AAD to the beneficial owner row id, not the merchant', async () => {
    const vault = makeVault();
    const boId1 = randomUUID();
    const boId2 = randomUUID();
    const sealed1 = await vault.sealForBo(boId1, samplePii());
    // open with the correct BO id under same merchantId works
    const opened = await vault.openForBo(boId1, 'merchant-1', sealed1);
    expect(opened.legalName.first).toBe('Alex');
    // Opening BO-1's ciphertext claiming it belongs to BO-2 must fail
    // — this is the explicit fix in the SEC-019 comment block.
    await expect(vault.openForBo(boId2, 'merchant-1', sealed1)).rejects.toThrow();
  });

  it('v1 legacy: AAD = pii:<merchantId>:v1 — exercised via openForBo with schemaVersion=1', async () => {
    // Hand-roll a legacy v1 envelope using the SAME AAD scheme the old
    // code used (merchant-id bound) so we can prove openForBo falls
    // back to it when schemaVersion=1.
    const vault = makeVault();
    const merchantId = 'merchant-legacy';
    const boId = randomUUID();
    // Reuse the structured `seal(userId)` path — its AAD is
    // `pii:<id>:v<schemaVersion>`, which matches the legacy v1 format.
    const legacy = await vault.seal(merchantId as any, samplePii());
    // The persisted schemaVersion on the legacy row is 1.
    const opened = await vault.openForBo(boId, merchantId, {
      ciphertext: legacy.ciphertext,
      nonce: legacy.nonce,
      dataKeyCiphertext: legacy.dataKeyCiphertext,
      kekId: legacy.kekId,
      schemaVersion: 1,
    });
    expect(opened.dateOfBirth).toBe('1990-04-15');
  });
});

describe('PiiVaultService — sealOpaque / openOpaque (arbitrary secret envelope)', () => {
  it('round-trips a string with the same aadContext', async () => {
    const vault = makeVault();
    const ctx = { scope: 'webhook_endpoint_secret', endpointId: 'ep-1' };
    const env = await vault.sealOpaque('hunter2', ctx);
    const out = await vault.openOpaque(env, ctx);
    expect(out.toString('utf8')).toBe('hunter2');
  });

  it('rejects open when aadContext differs (cross-row replay defence)', async () => {
    const vault = makeVault();
    const env = await vault.sealOpaque('hunter2', {
      scope: 'webhook_endpoint_secret',
      endpointId: 'ep-1',
    });
    await expect(
      vault.openOpaque(env, { scope: 'webhook_endpoint_secret', endpointId: 'ep-2' }),
    ).rejects.toThrow();
  });

  it('aadContext key ordering is normalised — re-open with reordered keys still succeeds', async () => {
    const vault = makeVault();
    const env = await vault.sealOpaque('payload', { a: '1', b: '2' });
    const out = await vault.openOpaque(env, { b: '2', a: '1' });
    expect(out.toString('utf8')).toBe('payload');
  });

  it('rejects an envelope with an unknown version byte', async () => {
    const vault = makeVault();
    const env = await vault.sealOpaque('x', { k: 'v' });
    const parsed = JSON.parse(Buffer.from(env, 'base64').toString('utf8'));
    parsed.v = 9999;
    const broken = Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64');
    await expect(vault.openOpaque(broken, { k: 'v' })).rejects.toThrow(
      /unknown opaque envelope version/,
    );
  });
});

describe('LocalKeyManager — hard guards', () => {
  it('refuses to construct with a missing KEK', () => {
    expect(() => new LocalKeyManager('')).toThrow(/32-byte/);
  });

  it('refuses to construct with the wrong-length hex KEK', () => {
    expect(() => new LocalKeyManager('abcd')).toThrow(/32-byte/);
  });

  it('decryptDataKey rejects a kekId mismatch (rotated KEK guard)', async () => {
    const km = new LocalKeyManager(KEK_HEX);
    const dk = await km.generateDataKey();
    await expect(
      km.decryptDataKey({ ciphertext: dk.ciphertext, kekId: 'some-other-kek' }),
    ).rejects.toThrow(/KEK mismatch/);
  });

  it('PiiVaultService → LocalKeyManager → AES-GCM full stack — generated DEK has the right length', async () => {
    const km = new LocalKeyManager(KEK_HEX);
    const dk = await km.generateDataKey();
    expect(dk.plaintext.length).toBe(32);
    expect(dk.kekId).toBe('local-dev');
    const round = await km.decryptDataKey({ ciphertext: dk.ciphertext, kekId: dk.kekId });
    expect(round.equals(dk.plaintext)).toBe(true);
  });
});
