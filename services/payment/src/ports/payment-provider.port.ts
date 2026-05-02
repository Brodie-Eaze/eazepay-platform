/**
 * PaymentProvider — abstraction over money rails. Production swap is
 * Modern Treasury (ACH origination), Stripe (card debit), and a wire/RTP
 * rail via the partner bank for instant disbursement.
 *
 * Two operations land in this round:
 *  - disburse: credit (money out) — loan funding to a destination.
 *  - debit:    debit  (money in)  — collect a repayment from a stored
 *               payment method. Reg E authorisation evidence is the
 *               PaymentMethod row's lifecycle, not this call.
 *
 * Both operations are idempotent on `idempotencyKey`. The provider
 * MUST NOT execute the same key twice; if it sees a duplicate it
 * returns the prior result.
 */
export interface DisburseInput {
  idempotencyKey: string;
  loanId: string;
  amountCents: bigint;
  /** Destination metadata. Shape varies by provider (bank account token,
   *  card token, FBO sub-ledger, etc.). Opaque to the orchestrator. */
  destination: Record<string, unknown>;
  /** Free-form metadata round-tripped to the provider. */
  metadata?: Record<string, string>;
}

export interface DebitInput {
  idempotencyKey: string;
  loanId: string;
  paymentMethodId: string;
  /** Provider token for the consumer's stored instrument. */
  providerToken: string;
  amountCents: bigint;
  metadata?: Record<string, string>;
}

export type ProviderResult =
  | { status: 'pending'; providerRef: string }
  | { status: 'succeeded'; providerRef: string; settledAt: string }
  | { status: 'failed'; providerRef: string; reasonCode: string };

export interface PaymentProvider {
  readonly name: string;
  disburse(input: DisburseInput): Promise<ProviderResult>;
  debit(input: DebitInput): Promise<ProviderResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
