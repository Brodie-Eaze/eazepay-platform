/**
 * BankAccountProvider — abstraction over consumer-permissioned bank
 * account linking (Plaid Link → Auth, MX, Finicity). The handoff is:
 *
 *   Client (mobile/web): runs Link, receives a short-lived public token
 *   API: passes the public token to exchange() to obtain a provider
 *        token + verified account metadata (last4, bank name)
 *   API: stores PaymentMethod with status='verified' on success
 *
 * The raw routing/account numbers NEVER touch our infra. Account
 * verification (NSF probability, signal score) runs server-side in the
 * provider; we only persist the boolean + metadata.
 */
export interface BankAccountExchangeInput {
  userId: string;
  publicToken: string;
}

export interface BankAccountExchangeResult {
  providerToken: string;
  last4: string;
  bankName: string | null;
  /** Optional fraud / NSF risk hint from the provider. */
  signal: 'low' | 'medium' | 'high' | null;
}

export interface BankAccountProvider {
  readonly name: string;
  exchange(input: BankAccountExchangeInput): Promise<BankAccountExchangeResult>;
}

export const BANK_ACCOUNT_PROVIDER = Symbol('BANK_ACCOUNT_PROVIDER');
