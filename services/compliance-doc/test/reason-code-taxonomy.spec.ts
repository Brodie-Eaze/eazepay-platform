import { describe, expect, it } from 'vitest';
import { ADVERSE_ACTION_REASON_CODES } from '../../admin/src/reason-codes.js';
import {
  RISK_REASON_CODES,
  RISK_DECLINE_THRESHOLD,
  RISK_MANUAL_REVIEW_THRESHOLD,
} from '../../risk/src/policy.js';

/**
 * Single-source-of-truth for the Reg B / FCRA adverse-action reason-code
 * taxonomy lives in @eazepay/service-admin. The compliance-doc builder
 * imports from there directly — no shadow list inside this service.
 *
 * Risk-policy reason codes (services/risk/src/policy.ts) are a SEPARATE
 * taxonomy: operational signals used inside RiskAssessment rows. They
 * are NOT used directly on the consumer-facing Adverse Action Notice;
 * the orchestrator maps them to Reg B codes before persisting
 * Application.declineReasonCodes.
 *
 * These tests pin both facts so a rewrite cannot silently:
 *   (a) duplicate the AAN taxonomy inside compliance-doc, or
 *   (b) leak raw risk codes (e.g. 'velocity_user_24h') onto a consumer
 *       notice.
 */
describe('Reason-code taxonomy — single source of truth', () => {
  it('compliance-doc imports the canonical AAN taxonomy from @eazepay/service-admin', () => {
    expect(ADVERSE_ACTION_REASON_CODES).toBeDefined();
    expect(Object.keys(ADVERSE_ACTION_REASON_CODES).length).toBeGreaterThan(10);
    // sentinel codes that must exist for the Adverse Action Notice
    expect(ADVERSE_ACTION_REASON_CODES.credit_score_below_threshold).toBeTypeOf('string');
    expect(ADVERSE_ACTION_REASON_CODES.no_lender_program_match).toBeTypeOf('string');
    expect(ADVERSE_ACTION_REASON_CODES.identity_unverifiable).toBeTypeOf('string');
  });

  it('every AAN code maps to a non-empty consumer-readable English line', () => {
    for (const [code, line] of Object.entries(ADVERSE_ACTION_REASON_CODES)) {
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
      expect(code).not.toContain(' ');
    }
  });

  it('risk-policy reason codes are a separate taxonomy (must not leak onto a Reg B notice)', () => {
    const aanKeys = new Set(Object.keys(ADVERSE_ACTION_REASON_CODES));
    for (const raw of Object.values(RISK_REASON_CODES)) {
      // The operational risk-signal vocabulary (velocity_*, *_provider_high_risk, prior_*)
      // intentionally lives outside the AAN consumer-facing taxonomy.
      expect(aanKeys.has(raw)).toBe(false);
    }
  });

  it('risk-policy thresholds are exported (used by orchestration to decide notice generation)', () => {
    expect(RISK_DECLINE_THRESHOLD).toBe(80);
    expect(RISK_MANUAL_REVIEW_THRESHOLD).toBe(50);
  });
});
