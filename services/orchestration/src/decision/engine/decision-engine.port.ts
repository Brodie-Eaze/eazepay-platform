import type { DecideRequest, DecideResponse } from './wire.js';

/**
 * DecisionEnginePort — the seam the orchestrator calls. Module-first
 * today (a TS import, ADR-0027), but defined as a port so extraction to
 * a standalone `/v1/decide` service is a projection, not a rewrite.
 */

export const DECISION_ENGINE_PORT = Symbol.for('eazepay.decision.enginePort');

/**
 * The exact versions a decision was computed under. Pinned per decision
 * so any decision replays byte-identically and an examiner can see which
 * rules/weights/catalog produced a given adverse-action notice. The
 * VALUES are sourced from the pinned config + catalog snapshot in P1;
 * this is only their shape.
 */
export interface EngineVersionPins {
  policyVersion: string;
  ruleVersion: string;
  scorerVersion: string;
  /** Pins the lender catalog + per-lender config the decision saw. */
  effectiveCatalogSnapshotId: string;
}

/**
 * What the port returns. `response` is the wire projection the portal
 * reads; `decisionId` + `versions` are what the persistence + audit
 * layer (P6) records. P6 extends this with the full basis record
 * (features, §615(a) factors, retainUntil) — left open deliberately.
 */
export interface DecisionOutcome {
  decisionId: string;
  versions: EngineVersionPins;
  response: DecideResponse;
}

export interface DecisionEnginePort {
  decide(request: DecideRequest, opts?: { signal?: AbortSignal }): Promise<DecisionOutcome>;
}
