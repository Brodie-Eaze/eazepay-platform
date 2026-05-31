import { describe, expect, it } from 'vitest';
import {
  ENGINE_CONFIG_V1,
  buildSnapshot,
  fingerprintCatalog,
  type CatalogProductFingerprint,
  type EngineConfig,
} from '../src/decision/engine/index.js';

const productA: CatalogProductFingerprint = {
  lenderProductId: 'lp_a',
  lenderId: 'l_a',
  tier: 'A',
  minAmountCents: '100000',
  maxAmountCents: '5000000',
  minTermMonths: 6,
  maxTermMonths: 60,
  permittedStates: ['TX', 'CA', 'NY'],
  enabled: true,
  priority: 10,
};
const productB: CatalogProductFingerprint = {
  lenderProductId: 'lp_b',
  lenderId: 'l_b',
  tier: 'B',
  minAmountCents: '50000',
  maxAmountCents: '2000000',
  minTermMonths: 3,
  maxTermMonths: 48,
  permittedStates: [], // nationwide
  enabled: true,
  priority: 20,
};

describe('fingerprintCatalog — order independence', () => {
  it('is invariant to product order', () => {
    expect(fingerprintCatalog([productA, productB])).toBe(fingerprintCatalog([productB, productA]));
  });

  it('is invariant to permitted-states order', () => {
    const reordered: CatalogProductFingerprint = {
      ...productA,
      permittedStates: ['NY', 'TX', 'CA'],
    };
    expect(fingerprintCatalog([reordered, productB])).toBe(
      fingerprintCatalog([productA, productB]),
    );
  });

  it('changes when an eligibility-relevant field changes', () => {
    const widened: CatalogProductFingerprint = { ...productA, maxAmountCents: '9999999' };
    expect(fingerprintCatalog([widened, productB])).not.toBe(
      fingerprintCatalog([productA, productB]),
    );
  });

  it('changes when a product is disabled', () => {
    const disabled: CatalogProductFingerprint = { ...productB, enabled: false };
    expect(fingerprintCatalog([productA, disabled])).not.toBe(
      fingerprintCatalog([productA, productB]),
    );
  });
});

describe('buildSnapshot — content addressing', () => {
  const fp = fingerprintCatalog([productA, productB]);

  it('is deterministic for the same config + catalog', () => {
    expect(buildSnapshot({ catalogFingerprint: fp }).snapshotId).toBe(
      buildSnapshot({ catalogFingerprint: fp }).snapshotId,
    );
  });

  it('changes the snapshot id when the catalog changes', () => {
    const otherFp = fingerprintCatalog([productA]);
    expect(buildSnapshot({ catalogFingerprint: fp }).snapshotId).not.toBe(
      buildSnapshot({ catalogFingerprint: otherFp }).snapshotId,
    );
  });

  it('changes the snapshot id when the config changes', () => {
    const tweaked: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      weights: { ...ENGINE_CONFIG_V1.weights, ficoPerPointAboveFloor: 11 },
    };
    expect(buildSnapshot({ catalogFingerprint: fp, config: tweaked }).snapshotId).not.toBe(
      buildSnapshot({ catalogFingerprint: fp }).snapshotId,
    );
  });

  it('records version pins and ties them to the snapshot id', () => {
    const snap = buildSnapshot({ catalogFingerprint: fp });
    expect(snap.versions.policyVersion).toBeTruthy();
    expect(snap.versions.ruleVersion).toBeTruthy();
    expect(snap.versions.scorerVersion).toBeTruthy();
    expect(snap.versions.effectiveCatalogSnapshotId).toBe(snap.snapshotId);
    expect(snap.configDigest).toHaveLength(64); // sha256 hex
  });
});

describe('ENGINE_CONFIG_V1 — replay-safety invariants', () => {
  it('is JSON-serialisable (no BigInt) so it can be hashed and stored', () => {
    expect(() => JSON.stringify(ENGINE_CONFIG_V1)).not.toThrow();
  });

  it('carries money as string-of-integer cents (ADR-0012)', () => {
    expect(typeof ENGINE_CONFIG_V1.envelope.maxAmountCents).toBe('string');
    expect(typeof ENGINE_CONFIG_V1.affordabilityBufferCents).toBe('string');
  });

  it('pins the MLA 36% MAPR cap at 3600 bps', () => {
    expect(ENGINE_CONFIG_V1.mlaMaprCapBps).toBe(3600);
  });

  it('is frozen — runtime mutation cannot silently change the digest', () => {
    expect(Object.isFrozen(ENGINE_CONFIG_V1)).toBe(true);
    expect(Object.isFrozen(ENGINE_CONFIG_V1.weights)).toBe(true);
    expect(Object.isFrozen(ENGINE_CONFIG_V1.tiers.A)).toBe(true);
  });
});
