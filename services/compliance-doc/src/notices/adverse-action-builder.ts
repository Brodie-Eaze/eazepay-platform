import { ADVERSE_ACTION_REASON_CODES } from '@eazepay/service-admin';
import type {
  AdverseActionLenderOfRecord,
  AdverseActionNoticeContent,
  AdverseActionRecipient,
  BureauContributor,
} from './adverse-action.types.js';
import { normalizeDeclineCodes } from './decline-code-mapper.js';

/**
 * Structural mirror of `ExcludedLender` from
 * `apps/partner-portal/lib/decision-engine.ts`. The compliance-doc
 * service cannot import directly from partner-portal (no workspace
 * edge), so we restate the shape here. The `included: false` literal is
 * load-bearing — see `buildAdverseActionNoticeFromExcludedLender` below.
 *
 * If partner-portal's `ExcludedLender` changes shape, this declaration
 * must be updated. The decision-engine spec carries a regression test
 * that asserts the shape on the partner-portal side; downstream type
 * drift will surface as a compile error in callers that try to pass a
 * partner-portal `RankedLender` through this builder.
 */
export interface ExcludedLenderForNotice {
  included: false;
  lenderId: string;
  displayName: string;
  reasonCode: string;
  regBReasonCode: string;
  principalReasonText: string;
}

/**
 * Compose a notice content object from the structured inputs an admin
 * or orchestration would have on hand.
 *
 * Reason codes arrive as RAW codes (lender-adapter / risk-gate /
 * decision-service strings). They are run through `normalizeDeclineCodes`
 * (ECOA-02), which:
 *   - passes through codes already in the Reg B taxonomy,
 *   - maps known raw codes to their accurate taxonomy member,
 *   - dedupes and caps at 4 (Reg B §1002.9(b)(2) specificity), and
 *   - throws `UnmappableDeclineCodeError` on anything it cannot justify.
 *
 * The throw is a hard failure on purpose: better to fail closed (and let
 * the caller alert + escalate) than ship a notice with a placeholder or a
 * fabricated reason. The caller (orchestration) must catch this and
 * fail LOUD — a missing statutory notice may never be silent.
 */
export function buildAdverseActionNotice(input: {
  recipient: AdverseActionRecipient;
  application: {
    id: string;
    amountDisplay: string;
    termDisplay: string;
    categoryDisplay: string;
    decisionDate: string;
  };
  lenderOfRecord: AdverseActionLenderOfRecord;
  reasonCodes: string[];
  bureau?: BureauContributor;
  policyVersion: string;
}): AdverseActionNoticeContent {
  // Map raw → Reg B taxonomy (dedup + ≤4). Throws on unmappable codes.
  const taxonomyCodes = normalizeDeclineCodes(input.reasonCodes);
  const reasons: string[] = [];
  for (const code of taxonomyCodes) {
    const line = (ADVERSE_ACTION_REASON_CODES as Record<string, string | undefined>)[code];
    if (!line) {
      // Unreachable in practice — normalizeDeclineCodes only returns
      // taxonomy members — but kept as a defensive backstop so a future
      // taxonomy edit can never emit a reason with no consumer-readable
      // line.
      throw new Error(`adverse_action_builder: unknown reason code "${code}"`);
    }
    reasons.push(line);
  }
  return {
    recipient: input.recipient,
    application: input.application,
    lenderOfRecord: input.lenderOfRecord,
    reasons,
    reasonCodes: taxonomyCodes,
    ...(input.bureau ? { bureau: input.bureau } : {}),
    policyVersion: input.policyVersion,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Type-safe entry point that constrains adverse-action generation to the
 * `included: false` arm of the partner-portal `RankedLender` union.
 *
 * Compile-time invariant: a caller cannot pass an `IncludedLender` here.
 * The parameter type `ExcludedLenderForNotice` carries the
 * `included: false` literal as a discriminant, so TypeScript refuses
 * `IncludedLender` (whose discriminant is `true`) and refuses any plain
 * object that doesn't witness the discriminant.
 *
 * The previous wide `RankedLender` shape made this invariant a runtime
 * concern — every caller had to remember `if (!r.included)` before
 * reading `regBReasonCode`, and a future caller that forgot the check
 * would silently ship an adverse-action notice with a placeholder
 * principal-reason line. Now the type system catches that bug.
 *
 * The runtime check on `excludedLender.included !== false` is defensive
 * — TS only enforces the discriminant at compile time, and the boundary
 * accepts JSON-deserialised payloads at the API edge.
 */
export function buildAdverseActionNoticeFromExcludedLender(input: {
  recipient: AdverseActionRecipient;
  application: {
    id: string;
    amountDisplay: string;
    termDisplay: string;
    categoryDisplay: string;
    decisionDate: string;
  };
  lenderOfRecord: AdverseActionLenderOfRecord;
  excludedLender: ExcludedLenderForNotice;
  bureau?: BureauContributor;
  policyVersion: string;
}): AdverseActionNoticeContent {
  // Runtime backstop for the JSON-deserialised case (TypeScript erases
  // the discriminant at runtime). A caller that smuggles an
  // `IncludedLender` through a JSON boundary will fail here loudly
  // rather than generate a malformed notice.
  if (input.excludedLender.included !== false) {
    throw new Error('adverse_action_builder: refusing to generate notice for an included lender');
  }
  return buildAdverseActionNotice({
    recipient: input.recipient,
    application: input.application,
    lenderOfRecord: input.lenderOfRecord,
    reasonCodes: [input.excludedLender.regBReasonCode],
    ...(input.bureau ? { bureau: input.bureau } : {}),
    policyVersion: input.policyVersion,
  });
}
