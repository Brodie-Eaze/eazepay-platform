/**
 * PRIV-014 — Retention-hold boundary for the right-to-erasure / crypto-shred
 * capability.
 *
 * THIS IS THE COMPLIANCE-CRITICAL SEAM. CCPA/CPRA §1798.105 grants a
 * consumer the right to deletion, but §1798.105(d) carves out data the
 * business is REQUIRED to retain to comply with a legal obligation. For a
 * lender that obligation is overwhelmingly BSA/AML:
 *
 *   - 31 CFR 1020.220(a)(3) — CIP identity records (name, DOB, address,
 *     SSN / identifying number) must be retained for 5 YEARS AFTER THE
 *     ACCOUNT IS CLOSED. An "account" here is the credit relationship; a
 *     paid-off or charged-off loan is a CLOSED account, and the 5-year
 *     clock runs FROM closure, not from origination.
 *   - 31 CFR 1010.430 / 1020.410 — general 5-year retention of records
 *     relevant to transactions, SARs and CTRs.
 *   - 15 USC 1681 (FCRA) / 12 CFR 1002 (ECOA/Reg B) — adverse-action and
 *     credit-decision records carry their own (shorter) holds.
 *
 * We therefore CANNOT crypto-shred the ConsumerProfile PII blob (which
 * holds the CIP identity tuple) for any consumer who has, or has ever
 * had, a credit relationship — doing so would destroy a record the law
 * requires us to keep, turning a privacy fix into a BSA violation.
 *
 * The policy below is an INJECTABLE PORT, not a hardcoded rule, for two
 * reasons:
 *   1. Auditors want the deletion-vs-retention boundary to be an explicit,
 *      reviewable artifact — a named class with documented predicates, not
 *      an `if` buried in a service method.
 *   2. The lawful boundary is jurisdiction- and product-specific and WILL
 *      change (state privacy laws, loan-product mix). Swapping the policy
 *      must not require touching the shred mechanics.
 *
 * DEFAULT-RETAIN SAFETY RULE: when the policy cannot positively prove a
 * datum is free of any retention obligation, it MUST return `retain` with
 * `uncertain: true` so the receipt flags it for human/legal review. Over-
 * retention is a recoverable privacy gap; over-deletion of a BSA record is
 * an unrecoverable regulatory breach. We bias hard toward retain.
 */

/** A single erasable data class on a subject (a consumer User). */
export type ErasableDatum =
  /** The envelope-encrypted KYC/CIP identity blob on ConsumerProfile
   *  (legal name, DOB, SSN-last-4, full street address). Crypto-shredded
   *  by destroying the per-subject DEK ciphertext. */
  | 'consumer_profile_pii'
  /** Contact / marketing PII held as plaintext columns on User
   *  (email, phone, display name). Tombstoned in place. */
  | 'user_contact_pii';

export type RetentionDecision =
  | {
      datum: ErasableDatum;
      action: 'shred';
      /** Human-readable justification recorded on the erasure receipt. */
      rationale: string;
    }
  | {
      datum: ErasableDatum;
      action: 'retain';
      /** The legal hold that forces retention (e.g. 'bsa_cip_5yr'). */
      hold: string;
      rationale: string;
      /** True when retention was chosen because the policy could NOT
       *  positively clear the datum — flags it for legal review rather
       *  than asserting a known obligation. */
      uncertain: boolean;
    };

/** Facts about a subject the policy reasons over. Assembled by the
 *  erasure service from tenant-scoped reads so the policy itself stays a
 *  pure, unit-testable function with no DB dependency. */
export interface SubjectRetentionFacts {
  userId: string;
  /** Total count of Loan rows ever created for this user — ANY value > 0
   *  means a credit relationship exists(ed) and the CIP hold applies. */
  loanCount: number;
  /** Count of loans NOT in a closed terminal state. Surfaced separately
   *  so a future policy can distinguish "open account" from "closed but
   *  within the 5yr tail" without another query. */
  openLoanCount: number;
  /** True if any Application exists. Applications carry FCRA/ECOA
   *  adverse-action retention but NOT (on their own) the CIP 5yr hold. */
  hasApplications: boolean;
  /** Escape hatch for a legal/ops-placed manual hold on the whole
   *  subject (litigation hold, regulatory inquiry). When true, NOTHING
   *  is shred. */
  manualLegalHold: boolean;
}

/**
 * Decides, per erasable datum, whether it may be crypto-shredded or must
 * be retained under a legal hold. Implementations MUST be pure and
 * deterministic over the supplied facts.
 */
export interface RetentionPolicy {
  decide(facts: SubjectRetentionFacts): RetentionDecision[];
}

export const RETENTION_POLICY = Symbol('RETENTION_POLICY');
