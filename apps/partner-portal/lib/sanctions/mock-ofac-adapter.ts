/**
 * MockOfacAdapter — deterministic in-process implementation of the
 * SanctionsScreen port for development + CI.
 *
 * DO NOT USE IN PRODUCTION.
 * ------------------------
 * This adapter does NOT screen against the real OFAC SDN list. It
 * returns `cleared` for every input, with a synthetic listVersion
 * marker that makes it obvious in evidence that no real screening
 * happened. Production deployments MUST swap this for a real provider
 * (LexisNexis Bridger, ComplyAdvantage, or a direct SDN.xml ingest)
 * before flipping the launch flag — see
 * `docs/runbooks/sanctions-re-screen.md`. `MerchantModule.forRoot`
 * already refuses to wire the mock outside `isDevelopment=true`; this
 * file additionally hard-codes the provider id `'mock-ofac'` so any
 * evidence row written by it is trivially auditable.
 *
 * Audit-log invariant
 * -------------------
 * Every call to `screen` / `screenEntity` writes an audit-log row
 * via the existing `lib/audit-log.ts::writeAuditLog` funnel. Losing
 * a row is preferable to failing the screen (writeAuditLog is
 * best-effort by design), but the row IS required for evidence: a
 * sanctions decision with no audit trail is indistinguishable from
 * not having screened at all. Operators MUST watch
 * `audit_log.write_failed` events for action='sanctions.screen.*'
 * — if those fire, the mock adapter is the lesser problem.
 */

import type {
  SanctionsScreen,
  SanctionsScreenEntityInput,
  SanctionsScreenInput,
  SanctionsScreenResult,
} from '@eazepay/integrations-core';
import { writeAuditLog } from '../audit-log';

const PROVIDER = 'mock-ofac' as const;
// Synthetic snapshot id — obviously NOT a real OFAC publish date so a
// reviewer scanning evidence rows can spot mock-sourced decisions at
// a glance.
const MOCK_LIST_VERSION = 'mock-sdn-0000-00-00';

export class MockOfacAdapter implements SanctionsScreen {
  async screen(input: SanctionsScreenInput): Promise<SanctionsScreenResult> {
    const result: SanctionsScreenResult = {
      status: 'cleared',
      matches: [],
      screenedAt: new Date().toISOString(),
      provider: PROVIDER,
      listVersion: MOCK_LIST_VERSION,
    };
    // Audit BEFORE returning so a crash between return and caller-side
    // persistence still leaves evidence of the screen having happened.
    // PII boundary: log the hashed last name + DOB year only — never
    // the full name, never the full DOB. The audit-log row is for
    // "we screened" provenance, not for re-identification.
    await writeAuditLog({
      actor: 'system:mock-ofac',
      action: 'sanctions.screen.person',
      targetType: 'sanctions_subject',
      targetId: null,
      payload: {
        provider: PROVIDER,
        listVersion: MOCK_LIST_VERSION,
        status: result.status,
        // why: don't leak BO PII into audit_log even in dev; the
        // sanctions_screen_log table (migration 0015) is the
        // authoritative evidence store and lives behind tighter ACLs.
        lastNameInitial: input.legalName.last.charAt(0).toUpperCase(),
        dobYear: input.dateOfBirth?.slice(0, 4) ?? null,
      },
      outcome: 'success',
    });
    return result;
  }

  async screenEntity(input: SanctionsScreenEntityInput): Promise<SanctionsScreenResult> {
    const result: SanctionsScreenResult = {
      status: 'cleared',
      matches: [],
      screenedAt: new Date().toISOString(),
      provider: PROVIDER,
      listVersion: MOCK_LIST_VERSION,
    };
    await writeAuditLog({
      actor: 'system:mock-ofac',
      action: 'sanctions.screen.entity',
      targetType: 'sanctions_subject',
      targetId: null,
      payload: {
        provider: PROVIDER,
        listVersion: MOCK_LIST_VERSION,
        status: result.status,
        // Legal name is already public registry info; EIN last-4 only.
        legalName: input.legalName,
        einLast4: input.ein ? input.ein.slice(-4) : null,
      },
      outcome: 'success',
    });
    return result;
  }
}
