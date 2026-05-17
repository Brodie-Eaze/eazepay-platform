import { Injectable } from '@nestjs/common';
import { HARD_KNOCKOUTS, POLICY_VERSION, REASON_CODES } from './policy.js';

export interface DecisionInput {
  requestedAmountCents: bigint;
  termMonths: number;
  /** Self-declared income for MVP affordability stub; CDR / Plaid feeds
   *  replace this once services/integration ships. */
  declaredMonthlyIncomeCents?: bigint;
  /** Self-declared monthly fixed obligations. */
  declaredMonthlyObligationsCents?: bigint;
}

export interface DecisionResult {
  passes: boolean;
  /** Reason codes — empty when `passes`. Map to Reg B taxonomy at notice time. */
  reasonCodes: string[];
  /** Indicative residual cents/month after this loan. Surfaced to UW console only. */
  residualCents: bigint | null;
  /** SR 11-7 traceability: same input + this version reproduces the decision. */
  policyVersion: string;
}

const ASSUMED_INCOME_CENTS = 600_000n; // $6,000 / month — reasonable MVP placeholder
const ASSUMED_OBLIGATIONS_CENTS = 200_000n;
const REQUIRED_BUFFER_CENTS = 50_000n; // $500 / month

@Injectable()
export class DecisionService {
  evaluate(input: DecisionInput): DecisionResult {
    const reasonCodes: string[] = [];

    if (input.requestedAmountCents > HARD_KNOCKOUTS.maxAmountCents) {
      reasonCodes.push(REASON_CODES.amountAboveCap);
    }
    if (
      input.termMonths < HARD_KNOCKOUTS.minTermMonths ||
      input.termMonths > HARD_KNOCKOUTS.maxTermMonths
    ) {
      reasonCodes.push(REASON_CODES.termOutOfRange);
    }

    if (reasonCodes.length > 0) {
      return { passes: false, reasonCodes, residualCents: null, policyVersion: POLICY_VERSION };
    }

    // Affordability — MVP stub. Real version pulls cashflow from Plaid /
    // bureau / payslip and sensitivity-tests at -10% income.
    const income = input.declaredMonthlyIncomeCents ?? ASSUMED_INCOME_CENTS;
    const obligations = input.declaredMonthlyObligationsCents ?? ASSUMED_OBLIGATIONS_CENTS;
    const monthlyPayment = this.estimateMonthlyPaymentCents(
      input.requestedAmountCents,
      input.termMonths,
    );
    const residual = income - obligations - monthlyPayment;

    if (residual < REQUIRED_BUFFER_CENTS) {
      reasonCodes.push(REASON_CODES.affordabilityFail);
      return {
        passes: false,
        reasonCodes,
        residualCents: residual,
        policyVersion: POLICY_VERSION,
      };
    }

    return {
      passes: true,
      reasonCodes: [],
      residualCents: residual,
      policyVersion: POLICY_VERSION,
    };
  }

  /** Crude APR-agnostic estimate (principal / term + 10% buffer). The
   *  contract-time amortization is exact — this is a screening figure. */
  private estimateMonthlyPaymentCents(principalCents: bigint, termMonths: number): bigint {
    const base = principalCents / BigInt(termMonths);
    return (base * 110n) / 100n;
  }
}
