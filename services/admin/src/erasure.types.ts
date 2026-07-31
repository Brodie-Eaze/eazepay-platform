import type { ErasableDatum } from './ports/retention-policy.port.js';

/**
 * PRIV-014 — structured erasure receipt.
 *
 * Returned by ErasureService.eraseConsumer and persisted (as JSON) on the
 * AuditOutbox `after` payload. This is the auditor-facing evidence object:
 * it records, per data class, whether the datum was crypto-shredded or
 * retained-under-hold, with the rationale and (for retains) the hold id.
 *
 * The receipt is deliberately self-describing — a regulator reading a
 * single audit row can reconstruct exactly what happened to the subject's
 * data and WHY each retained item was kept, without needing the source.
 */

export interface ShreddedItem {
  datum: ErasableDatum;
  outcome: 'shredded';
  /** Which physical columns were destroyed/tombstoned. */
  columns: string[];
  rationale: string;
}

export interface RetainedItem {
  datum: ErasableDatum;
  outcome: 'retained';
  /** Legal hold that forced retention (e.g. 'bsa_cip_5yr_post_closure'). */
  hold: string;
  rationale: string;
  /** True when retention was a default-retain ("unsure") choice — these
   *  items are the ones a human/legal reviewer should look at. */
  flaggedForReview: boolean;
}

export type ErasureItem = ShreddedItem | RetainedItem;

export interface ErasureReceipt {
  /** Unique id for this erasure run; also written to the audit row. */
  receiptId: string;
  subjectUserId: string;
  /** Admin who executed the erasure (the dual-control requester is the
   *  approver on the parent ComplianceReview — see ErasureService). */
  executedByUserId: string;
  executedAt: string;
  /** Snapshot of the facts the retention policy reasoned over — pinned
   *  so the decision is reproducible at audit time even if the subject's
   *  loan state later changes. */
  retentionFacts: {
    loanCount: number;
    openLoanCount: number;
    hasApplications: boolean;
    manualLegalHold: boolean;
  };
  items: ErasureItem[];
  /** Convenience rollup. */
  summary: {
    shreddedCount: number;
    retainedCount: number;
    /** Number of retained items flagged uncertain (need legal review). */
    reviewFlaggedCount: number;
  };
}
