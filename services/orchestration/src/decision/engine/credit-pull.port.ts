/**
 * CreditPullPort — the seam between the decision engine and a credit-data
 * provider (ADR-0030: HighSale primary, CRS alternate). Mirrors the
 * LenderAdapter port shape (a keyed provider + an abortable async call).
 *
 * Standalone-ready: the engine can run on the prequal signals the portal
 * already sends, OR perform its own pull through this port. Defining the
 * port now makes adding a provider a non-event (ADR-0027).
 */

export const CREDIT_PULL_PORT = Symbol.for('eazepay.decision.creditPullPort');

export type CreditDataProvider = 'highsale' | 'crs';

/**
 * FCRA §604 permissible purpose. The caller asserts it; the adapter
 * MUST re-check it fail-closed in the same transaction before any bureau
 * call — a pull without a permissible purpose is an FCRA violation, not
 * a recoverable error (ADR-0030).
 */
export type PermissiblePurpose =
  | 'consumer_initiated_credit_transaction' // §604(a)(3)(A)
  | 'written_instructions_of_consumer'; // §604(a)(2)

export interface CreditPullInput {
  applicationId: string;
  userId: string;
  permissiblePurpose: PermissiblePurpose;
  /**
   * Opaque reference to the consumer identity in the PII vault
   * (ADR-0016). The adapter performs a just-in-time unmask (ADR-0017) —
   * raw identifiers (SSN, DOB) never transit this contract.
   */
  subjectRef: string;
}

/**
 * Normalised projection of a credit pull. The raw bureau payload is
 * stored separately, encrypted (ADR-0016); this is the shape the engine
 * reasons over plus the FCRA §615(a) disclosure inputs.
 */
export interface CreditPullResult {
  snapshotId: string;
  provider: CreditDataProvider;
  /** ISO 8601 UTC. Drives the ~14-day snapshot-freshness window (ADR-0028). */
  pulledAt: string;
  permissiblePurpose: PermissiblePurpose;

  /**
   * §615(a) disclosure inputs: the CRA, the score, and up to four KEY
   * FACTORS. This list is DISTINCT from the Reg B adverse-action reasons
   * (those come from the lending decision, not the bureau). Conflating
   * the two is an FCRA defect (ADR-0030).
   */
  bureauName: string | null;
  score: number | null;
  scoreModel: string | null;
  scoreRangeLow: number | null;
  scoreRangeHigh: number | null;
  /** ≤4, ordered by impact (§615(a)); the adapter enforces the cap. */
  keyFactors: string[];

  /** Signals the engine derives tier/eligibility from. NULL = thin file. */
  dti: number | null;
  openTradelines: number | null;
  derogatoryMarks: number | null;
}

export interface CreditPullPort {
  readonly provider: CreditDataProvider;
  /**
   * Performs the pull. THROWS on any failure (provider down, timeout,
   * permissible-purpose failure) — it never returns a synthetic result.
   * The collect phase catches, persists to the encrypted DLQ, and the
   * decision becomes INCOMPLETE. We never fail open (ADR-0028, ADR-0030).
   */
  pull(input: CreditPullInput, opts: { signal: AbortSignal }): Promise<CreditPullResult>;
}
