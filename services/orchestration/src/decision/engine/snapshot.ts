import { sha256Hex, stableJsonSha256 } from '@eazepay/shared-utils';
import type { Brand } from './financials.js';
import type { EngineVersionPins } from './decision-engine.port.js';
import {
  ENGINE_CONFIG_V1,
  ENGINE_POLICY_VERSION,
  ENGINE_RULE_VERSION,
  ENGINE_SCORER_VERSION,
  type EngineConfig,
} from './config.js';

/**
 * The eligibility-relevant projection of one catalog product. Any change
 * to these fields MUST change the catalog fingerprint (and therefore the
 * snapshot id), so a replayed decision provably saw the same catalog.
 * Money is string-of-integer cents (ADR-0012).
 */
export interface CatalogProductFingerprint {
  lenderProductId: string;
  lenderId: string;
  tier: string;
  minAmountCents: string;
  maxAmountCents: string;
  minTermMonths: number;
  maxTermMonths: number;
  /** Empty = nationwide. */
  permittedStates: string[];
  /** Brand allowlist. Empty = serves every brand (no restriction). */
  permittedBrands: Brand[];
  enabled: boolean;
  priority: number;
}

/**
 * Content fingerprint of the catalog the engine evaluated against.
 * Order-independent: products and permitted-states are sorted first, so
 * a row-order change in the DB never changes the fingerprint — only a
 * change to an eligibility-relevant value does.
 */
export function fingerprintCatalog(products: readonly CatalogProductFingerprint[]): string {
  const normalised = products
    .map((p) => ({
      ...p,
      permittedStates: [...p.permittedStates].sort(),
      permittedBrands: [...p.permittedBrands].sort(),
    }))
    .sort((a, b) => a.lenderProductId.localeCompare(b.lenderProductId));
  return stableJsonSha256(normalised);
}

export interface EngineConfigSnapshot {
  /** effectiveCatalogSnapshotId — binds the config blob AND the catalog. */
  snapshotId: string;
  versions: EngineVersionPins;
  configDigest: string;
  catalogFingerprint: string;
  config: EngineConfig;
}

/**
 * Resolve the snapshot a decision is computed under. The snapshot id
 * binds BOTH the engine config and the exact catalog evaluated — an id
 * that omitted the catalog would let a catalog change replay under the
 * same id, which is an audit lie (ADR-0028). The catalog fingerprint is
 * therefore required, never defaulted.
 */
export function buildSnapshot(input: {
  catalogFingerprint: string;
  config?: EngineConfig;
}): EngineConfigSnapshot {
  const config = input.config ?? ENGINE_CONFIG_V1;
  const configDigest = stableJsonSha256(config);
  const snapshotId = sha256Hex(`${configDigest}:${input.catalogFingerprint}`);
  return {
    snapshotId,
    versions: {
      policyVersion: ENGINE_POLICY_VERSION,
      ruleVersion: ENGINE_RULE_VERSION,
      scorerVersion: ENGINE_SCORER_VERSION,
      effectiveCatalogSnapshotId: snapshotId,
    },
    configDigest,
    catalogFingerprint: input.catalogFingerprint,
    config,
  };
}
