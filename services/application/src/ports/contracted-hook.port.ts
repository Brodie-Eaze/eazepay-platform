/**
 * Side-effect hook called *after* an application transitions to
 * `contracted` (i.e. the consumer's e-signed offer + Loan row landed).
 * Lets services/payment kick disbursement without services/application
 * having to know payment exists.
 *
 * Default implementation is a no-op. apps/api wires PaymentService.
 *
 * Implementations MUST be safe to invoke after the contracted
 * transition has already committed; they may run arbitrarily long
 * (defer to a queue for prod).
 */
export interface ContractedHook {
  onContracted(args: { applicationId: string; loanId: string }): Promise<void>;
}

export const CONTRACTED_HOOK = Symbol('CONTRACTED_HOOK');
