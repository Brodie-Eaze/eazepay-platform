/**
 * KybValidationError — thin factory over the shared ProblemError so the
 * KYB code paths have ONE place to raise stable, machine-dispatched
 * validation failures.
 *
 * Status 422 (Unprocessable Entity) because the request is structurally
 * valid (auth ok, IDs resolve, JSON parses) but the merchant's KYB
 * inputs fail a regulatory rule (FinCEN CDD beneficial-owner coverage,
 * controller prong, etc). Stable `code` values let downstream UIs +
 * the operator console dispatch on the failure without parsing text.
 *
 * Known codes (extend by ADR — these are surfaced in the runbook):
 *   - 'bo_coverage_insufficient' — declared owners don't sum to ≥75% AND
 *      no single declared ≥25% owner is documented. FinCEN CDD requires
 *      each beneficial owner ≥25%; the rule guarantees up to four BOs
 *      cover the entity, so cumulative coverage of 75% is the floor.
 *   - 'bo_controller_missing'   — no controller-prong BO declared. CDD
 *      Rule §1010.230(d)(2) — a single individual with significant
 *      managerial control MUST be on file regardless of ownership.
 *   - 'sanctions_halt'          — OFAC screen returned match/review/error
 *      for the entity or a BO; onboarding halts to manual_review.
 */

import { UnprocessableEntity } from '@eazepay/shared-utils';

export type KybValidationCode =
  | 'bo_coverage_insufficient'
  | 'bo_controller_missing'
  | 'sanctions_halt';

export interface KybValidationErrorInput {
  readonly code: KybValidationCode;
  readonly detail?: string;
}

export function KybValidationError(input: KybValidationErrorInput): Error {
  return UnprocessableEntity({
    code: input.code,
    ...(input.detail !== undefined && { detail: input.detail }),
  });
}
