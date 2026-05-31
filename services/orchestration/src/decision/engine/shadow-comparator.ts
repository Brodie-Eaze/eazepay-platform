import { isIncludedLender, type DecideResponse } from './wire.js';
import type { RegBReasonCode } from './reason-codes.js';

/**
 * Shadow comparator (P7a) — the safety net for a dual-run cutover.
 *
 * Before the new engine replaces the legacy `scoreLender()`, both run on the
 * same request and their outputs are diffed. The new engine is allowed to
 * diverge in exactly the ways ADR-0029 makes principled — a brand-mismatch or
 * MLA-cap SUPPRESSION removes a lender the legacy code would have offered —
 * so those lenders are subtracted before the diff ("modulo suppressed
 * brand-mismatches"). Any OTHER divergence is a regression to investigate
 * before cutover, not after.
 *
 * Pure + standalone (ADR-0027): set math over two already-computed views, no
 * IO. It compares the consumer-visible facts (which lenders, which decline
 * reasons), never propensity scores or rank order — those are expected to
 * differ and are not a correctness signal.
 */

/** The normalised legacy decision, adapted from `scoreLender()`'s output. */
export interface LegacyDecisionView {
  /** Lender ids the legacy engine offered (order irrelevant — compared as a set). */
  includedLenderIds: readonly string[];
  /**
   * Decline reason codes the legacy engine surfaced, if any. Optional: the
   * legacy code predates the Reg B taxonomy, so reason divergence is only
   * checked when the adapter can supply codes.
   */
  reasonCodes?: readonly string[];
}

export interface ShadowComparison {
  /** True iff the included sets agree (modulo suppressions) and reasons agree. */
  matches: boolean;
  /** Legacy offered, engine did not — after removing known suppressions. */
  missingFromEngine: string[];
  /** Engine offered, legacy did not. */
  extraInEngine: string[];
  /** Reason codes on exactly one side (only when legacy supplies reasons). */
  reasonCodeDivergence: string[];
  /** Suppressed lenders deliberately excluded from the diff (brand / MLA). */
  suppressed: string[];
}

/**
 * Diff the new engine's wire response against the legacy view. `suppressedLenderIds`
 * are the lenders the new policy intentionally drops (brand-mismatch / MLA
 * cap) — they are removed from the legacy included set so a deliberate
 * suppression never masquerades as a missing offer.
 */
export function compareToLegacy(args: {
  legacy: LegacyDecisionView;
  engine: DecideResponse;
  suppressedLenderIds?: readonly string[];
}): ShadowComparison {
  const suppressed = new Set(args.suppressedLenderIds ?? []);

  const legacyIncluded = new Set(args.legacy.includedLenderIds);
  // A suppressed lender is no longer expected on the legacy side.
  for (const id of suppressed) legacyIncluded.delete(id);

  const engineIncluded = new Set(
    args.engine.rankedLenders.filter(isIncludedLender).map((l) => l.lenderId),
  );

  const missingFromEngine = difference(legacyIncluded, engineIncluded);
  const extraInEngine = difference(engineIncluded, legacyIncluded);

  const reasonCodeDivergence =
    args.legacy.reasonCodes === undefined
      ? []
      : symmetricDifference(new Set(args.legacy.reasonCodes), engineReasonCodes(args.engine));

  return {
    matches:
      missingFromEngine.length === 0 &&
      extraInEngine.length === 0 &&
      reasonCodeDivergence.length === 0,
    missingFromEngine,
    extraInEngine,
    reasonCodeDivergence,
    suppressed: [...suppressed].sort(),
  };
}

/** The set of Reg B reason codes the engine surfaced across its excluded lenders. */
function engineReasonCodes(engine: DecideResponse): Set<RegBReasonCode> {
  const codes = new Set<RegBReasonCode>();
  for (const lender of engine.rankedLenders) {
    if (!lender.included) codes.add(lender.regBReasonCode);
  }
  return codes;
}

/** Sorted a \ b — deterministic output for a stable diff. */
function difference(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

/** Sorted symmetric difference — elements in exactly one set. */
function symmetricDifference(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const x of a) if (!b.has(x)) out.push(x);
  for (const x of b) if (!a.has(x)) out.push(x);
  return out.sort();
}
