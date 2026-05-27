/**
 * SanctionsScreen — port interface for OFAC SDN / sanctions screening.
 *
 * WHY THIS PORT EXISTS
 * --------------------
 * 31 CFR §501 (OFAC) and FinCEN's CDD Rule require that every customer
 * — and, for legal-entity customers, every beneficial owner ≥25% +
 * the controller — is screened against the OFAC Specially Designated
 * Nationals list at onboarding AND on a recurring cadence. A hit is
 * not a soft signal: the program must halt the relationship and
 * escalate to a human reviewer with the matched list snapshot in
 * evidence (BSA 5-year retention).
 *
 * The platform integrates against this port — never against a specific
 * vendor SDK — so that the production OFAC adapter (LexisNexis Bridger,
 * ComplyAdvantage, or a direct-from-Treasury SDN.xml ingest) drops in
 * without touching merchant onboarding, KYB, or the re-screen cron.
 *
 * The mock adapter at `apps/partner-portal/lib/sanctions/mock-ofac-adapter.ts`
 * implements this interface but MUST NOT be wired in production —
 * `MerchantModule.forRoot` rejects it outside development.
 *
 * SHAPE NOTES
 * -----------
 *  - `screen` covers natural persons (BOs, controllers). `screenEntity`
 *    covers legal entities (the merchant itself). Both return the same
 *    discriminated result so the caller has one switch site.
 *  - `status` is closed at four values. 'review' and 'match' both halt
 *    onboarding; the difference is human-review confidence vs. confirmed
 *    list hit. 'error' is upstream failure and is NEVER treated as
 *    'cleared' — the caller must halt and surface for retry.
 *  - `screenedAt` and `listVersion` are required for BSA evidence so a
 *    reviewer can reconstruct which SDN snapshot the decision was made
 *    against months later.
 *  - `matches` is opaque vendor JSON; the port doesn't constrain it
 *    because every provider returns a different shape. Adapters MUST
 *    redact / not return raw SSN-style PII inside this field.
 */

export type SanctionsStatus = 'cleared' | 'review' | 'match' | 'error';

export interface SanctionsMatch {
  /** Vendor-side match identifier. Stable across re-screens for the
   *  same individual + same list version. */
  readonly matchId: string;
  /** OFAC SDN list name (e.g. 'SDN', 'SSI', 'NS-PLC'). */
  readonly listName: string;
  /** Vendor score 0–100 (100 = exact). Adapters that don't surface a
   *  score MUST omit the field rather than fabricating one. */
  readonly score?: number;
  /** Human-readable reason — operator-facing only, never echoed to
   *  the merchant per OFAC reporting guidance. */
  readonly reason: string;
}

export interface SanctionsScreenResult {
  readonly status: SanctionsStatus;
  /** Populated when status is 'review' or 'match'. Empty / omitted on
   *  'cleared' and 'error'. */
  readonly matches?: readonly SanctionsMatch[];
  /** ISO-8601 UTC. Required for BSA 5-year retention evidence. */
  readonly screenedAt: string;
  /** Discriminator for which adapter produced this result — pinned to
   *  the audit log so a reviewer can prove which provider was active
   *  at decision time. */
  readonly provider: 'mock-ofac' | 'lexisnexis-bridger' | 'complyadvantage' | 'ofac-direct';
  /** OFAC SDN.xml publish date (or vendor list snapshot id). Required
   *  on 'cleared' / 'review' / 'match' so the evidence row can answer
   *  "which list version did we screen against?". Optional only on
   *  'error' results where no list was loaded. */
  readonly listVersion?: string;
  /** Operator-facing error reason. Set ONLY when status === 'error'. */
  readonly errorReason?: string;
}

export interface SanctionsScreenInput {
  readonly legalName: { first: string; middle?: string; last: string };
  /** ISO YYYY-MM-DD. Optional because not every CIP record carries one,
   *  but PROVIDING it materially reduces false positives — call sites
   *  SHOULD pass DOB when it's on file. */
  readonly dateOfBirth?: string;
}

export interface SanctionsScreenEntityInput {
  readonly legalName: string;
  /** EIN (XX-XXXXXXX). Optional — entity screens degrade to name-only
   *  matching when EIN is unknown, which raises false-positive rates. */
  readonly ein?: string;
}

export interface SanctionsScreen {
  /**
   * Screen a natural person (beneficial owner, controller, principal).
   * Implementations MUST be idempotent for a given (name, dob) input
   * within a single SDN list version — callers may retry on transient
   * 'error' results without producing duplicate evidence rows.
   */
  screen(input: SanctionsScreenInput): Promise<SanctionsScreenResult>;

  /**
   * Screen a legal entity (the merchant itself).
   */
  screenEntity(input: SanctionsScreenEntityInput): Promise<SanctionsScreenResult>;
}

/** Nest DI token. */
export const SANCTIONS_SCREEN = Symbol('SANCTIONS_SCREEN');
