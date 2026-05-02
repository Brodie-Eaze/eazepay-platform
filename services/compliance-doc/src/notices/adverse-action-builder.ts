import { ADVERSE_ACTION_REASON_CODES } from '@eazepay/service-admin';
import type {
  AdverseActionLenderOfRecord,
  AdverseActionNoticeContent,
  AdverseActionRecipient,
  BureauContributor,
} from './adverse-action.types.js';

/**
 * Compose a notice content object from the structured inputs an admin
 * or orchestration would have on hand. Reason codes are validated
 * against the taxonomy here — an unknown code is a hard failure
 * (better to fail closed than ship a notice with a placeholder line).
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
  const reasons: string[] = [];
  for (const code of input.reasonCodes) {
    const line = (ADVERSE_ACTION_REASON_CODES as Record<string, string | undefined>)[code];
    if (!line) {
      throw new Error(`adverse_action_builder: unknown reason code "${code}"`);
    }
    reasons.push(line);
  }
  return {
    recipient: input.recipient,
    application: input.application,
    lenderOfRecord: input.lenderOfRecord,
    reasons,
    reasonCodes: [...input.reasonCodes],
    ...(input.bureau ? { bureau: input.bureau } : {}),
    policyVersion: input.policyVersion,
    generatedAt: new Date().toISOString(),
  };
}
