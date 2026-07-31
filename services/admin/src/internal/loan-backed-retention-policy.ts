import { Injectable } from '@nestjs/common';
import type {
  RetentionDecision,
  RetentionPolicy,
  SubjectRetentionFacts,
} from '../ports/retention-policy.port.js';

/**
 * PRIV-014 — default retention policy for EAZEPay consumer-financing.
 *
 * Encodes the BSA/AML CIP carve-out (31 CFR 1020.220) plus a default-
 * retain bias. The single load-bearing predicate is:
 *
 *   "Has this consumer EVER had a credit relationship (any Loan row)?"
 *
 * If yes → the ConsumerProfile PII blob IS a CIP identity record under a
 * live 5-year-post-closure hold and is RETAINED. If no → the consumer is
 * a pure prospect/applicant; their KYC blob carries no CIP obligation and
 * may be crypto-shredded.
 *
 * Contact PII on the User row (email / phone / display name) is treated
 * as separable marketing/contact data. When the subject is NOT loan-
 * backed it is shred outright. When the subject IS loan-backed we STILL
 * retain it — conservatively — because email/phone can themselves form
 * part of the CIP/identity and transaction record, and over-retaining a
 * contact field is the safe side of the bias. A future, lawyer-reviewed
 * policy may split this finer (e.g. shred marketing-only fields while
 * retaining the identifying ones); that refinement is a policy swap, not
 * a mechanics change.
 *
 * Manual legal hold (litigation / regulatory inquiry) short-circuits to
 * retain-everything regardless of loan state.
 *
 * NOTE: this policy is deliberately CONSERVATIVE, not maximally privacy-
 * forward. The hard rule in PRIV-014 is "if unsure, RETAIN and flag" —
 * we would rather a lawyer green-light loosening it than discover we
 * shredded a record FinCEN expected to see.
 */
@Injectable()
export class LoanBackedRetentionPolicy implements RetentionPolicy {
  /** Stable identifier for the CIP hold, recorded on the receipt. */
  static readonly HOLD_BSA_CIP = 'bsa_cip_5yr_post_closure';
  /** Stable identifier for an ops/legal-placed manual hold. */
  static readonly HOLD_MANUAL_LEGAL = 'manual_legal_hold';

  decide(facts: SubjectRetentionFacts): RetentionDecision[] {
    // Manual hold wins over everything. Nothing is destroyed.
    if (facts.manualLegalHold) {
      return [
        {
          datum: 'consumer_profile_pii',
          action: 'retain',
          hold: LoanBackedRetentionPolicy.HOLD_MANUAL_LEGAL,
          rationale:
            'Manual legal/litigation hold is active on this subject; all PII retained pending hold release.',
          uncertain: false,
        },
        {
          datum: 'user_contact_pii',
          action: 'retain',
          hold: LoanBackedRetentionPolicy.HOLD_MANUAL_LEGAL,
          rationale: 'Manual legal/litigation hold active; contact PII retained.',
          uncertain: false,
        },
      ];
    }

    const loanBacked = facts.loanCount > 0;

    const profileDecision: RetentionDecision = loanBacked
      ? {
          datum: 'consumer_profile_pii',
          action: 'retain',
          hold: LoanBackedRetentionPolicy.HOLD_BSA_CIP,
          rationale:
            `Subject has ${facts.loanCount} loan record(s) (${facts.openLoanCount} open). ` +
            'The ConsumerProfile KYC blob is a CIP identity record under 31 CFR 1020.220 ' +
            '(5-year retention running from account closure). Retained — cannot be erased.',
          // Known, citeable obligation — not an "unsure" retain.
          uncertain: false,
        }
      : {
          datum: 'consumer_profile_pii',
          action: 'shred',
          rationale:
            'Subject has no loan/credit relationship (no Loan rows). KYC blob carries no CIP ' +
            'retention obligation; crypto-shredded by destroying the per-subject DEK.',
        };

    const contactDecision: RetentionDecision = loanBacked
      ? {
          datum: 'user_contact_pii',
          action: 'retain',
          hold: LoanBackedRetentionPolicy.HOLD_BSA_CIP,
          rationale:
            'Subject is loan-backed; email/phone may form part of the retained CIP/transaction ' +
            'record. Retained conservatively (default-retain bias) — flag for legal review if a ' +
            'finer marketing-only carve-out is desired.',
          // We are CHOOSING to over-retain rather than asserting a hard
          // statutory line on each contact field — flag it for review.
          uncertain: true,
        }
      : {
          datum: 'user_contact_pii',
          action: 'shred',
          rationale:
            'Subject has no credit relationship; contact PII is marketing/contact data with no ' +
            'retention obligation. Tombstoned in place.',
        };

    return [profileDecision, contactDecision];
  }
}
