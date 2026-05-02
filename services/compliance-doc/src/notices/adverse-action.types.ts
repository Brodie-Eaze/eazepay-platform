/**
 * Adverse Action Notice — structured form. Independent of the render
 * target (text, HTML, PDF) so the same content can produce all three.
 *
 * The structure mirrors the consumer-facing notice required by:
 *  - ECOA / Reg B §1002.9 — notice of action taken, principal reasons,
 *    ECOA non-discrimination notice, federal-agency contact.
 *  - FCRA §615(a) — when consumer report info contributed to the
 *    adverse action: bureau identity + contact, score disclosure (if
 *    available), notice of right to free disclosure within 60 days,
 *    notice of right to dispute accuracy.
 *
 * Specific reasons (not generic "credit policy") protect ECOA
 * defensibility — codes flow from the Reg B taxonomy in
 * @eazepay/service-admin and are mapped to consumer-readable strings
 * here at render time.
 */
export interface AdverseActionRecipient {
  legalName: string;
  email?: string | null;
  phone?: string | null;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface AdverseActionApplication {
  id: string;
  /** Consumer-facing display amount, e.g. "$10,000.00". */
  amountDisplay: string;
  /** Term shown e.g. "36 months". */
  termDisplay: string;
  /** "Personal", "Auto", etc. */
  categoryDisplay: string;
  decisionDate: string; // YYYY-MM-DD
}

export interface AdverseActionLenderOfRecord {
  legalName: string;
  /** Mailing address printed in the notice. */
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  /** "EazePay (servicer for {legalName})" or similar. */
  servicerLine?: string;
}

export interface BureauContributor {
  /** "Experian", "Equifax", "TransUnion". */
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  /** Score the bureau supplied (0-999), if available. */
  score?: number;
  /** Score range used for that bureau (e.g. "300-850"). */
  scoreRangeDisplay?: string;
  /** Up to 4 key factors (FCRA §609(f)) the bureau identified — not the
   *  Reg B reasons for the decision but the score-impacting factors. */
  keyFactors?: string[];
}

export interface AdverseActionNoticeContent {
  recipient: AdverseActionRecipient;
  application: AdverseActionApplication;
  lenderOfRecord: AdverseActionLenderOfRecord;
  /** Specific Reg B reasons (consumer-readable lines). */
  reasons: string[];
  /** Pre-stamped reason codes for audit; not rendered in the body. */
  reasonCodes: string[];
  /** Populated when a consumer report contributed. */
  bureau?: BureauContributor;
  /** Static taxonomy version that produced this notice. */
  policyVersion: string;
  /** ISO datetime; rendered as the notice date. */
  generatedAt: string;
}
