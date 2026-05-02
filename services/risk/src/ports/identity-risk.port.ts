/**
 * IdentityRiskProvider — abstraction over Emailage / Telesign / Ekata.
 * Inputs: email + phone. Output: a normalised risk score.
 */
export interface IdentityRiskInput {
  email?: string | null;
  phone?: string | null;
}

export interface IdentityRiskResult {
  /** 0-100 each; null = no signal (or input not provided). */
  emailScore: number | null;
  phoneScore: number | null;
  reasonCodes: string[];
  raw?: unknown;
}

export interface IdentityRiskProvider {
  readonly name: string;
  evaluate(input: IdentityRiskInput): Promise<IdentityRiskResult>;
}

export const IDENTITY_RISK_PROVIDER = Symbol('IDENTITY_RISK_PROVIDER');
