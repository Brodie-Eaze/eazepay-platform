/**
 * Risk policy version. Bump on every material change to weights,
 * thresholds, or signal sources. Stamped onto every RiskAssessment row
 * for SR 11-7-aligned reproducibility.
 */
export const RISK_POLICY_VERSION = '2026.05.02-mvp1';

/**
 * Composite score thresholds. The decision is consultative:
 *  - score >= 80     → decline (orchestration short-circuits to declined)
 *  - 50 <= score < 80 → manual_review (orchestration may still route,
 *                                       but admin queue picks it up)
 *  - score < 50      → accept (proceed normally)
 */
export const RISK_DECLINE_THRESHOLD = 80;
export const RISK_MANUAL_REVIEW_THRESHOLD = 50;

/**
 * Stable reason-code taxonomy. Add codes; do not rename.
 */
export const RISK_REASON_CODES = {
  velocityUser24h: 'velocity_user_24h',
  velocityIp24h: 'velocity_ip_24h',
  velocityDevice24h: 'velocity_device_24h',
  deviceProviderHigh: 'device_provider_high_risk',
  emailProviderHigh: 'email_provider_high_risk',
  phoneProviderHigh: 'phone_provider_high_risk',
  priorChargeOff: 'prior_charge_off',
  priorRecentDecline: 'prior_recent_decline',
} as const;
