/**
 * DeviceRiskProvider — abstraction over Sift / Castle / SEON / Plaid
 * Signal. Inputs: device fingerprint + IP + UA. Output: a 0-100
 * normalised risk score and provider-specific reason codes.
 */
export interface DeviceRiskInput {
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Anchor entity for the provider's session model. */
  userId?: string;
}

export interface DeviceRiskResult {
  /** 0-100 (higher = riskier). Null = no signal (provider degraded). */
  score: number | null;
  reasonCodes: string[];
  /** Raw provider response — kept for audit + model monitoring. */
  raw?: unknown;
}

export interface DeviceRiskProvider {
  readonly name: string;
  evaluate(input: DeviceRiskInput): Promise<DeviceRiskResult>;
}

export const DEVICE_RISK_PROVIDER = Symbol('DEVICE_RISK_PROVIDER');
