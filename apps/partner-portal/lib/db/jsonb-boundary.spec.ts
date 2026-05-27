/**
 * Round-trip tests for the jsonb boundary helpers (migration 0014).
 *
 * What "round-trip" means here, since this suite does NOT touch the
 * real database: write-shape -> Zod validation -> read-shape parses
 * the same object back to a structurally-equal value. The DB itself
 * is a passthrough for `jsonb`, so a passing round-trip here implies
 * the value can survive a real INSERT/SELECT.
 *
 * One test per converted column. Each test exercises:
 *   (a) a happy-path canonical value,
 *   (b) a malformed value that the boundary helper REJECTS — proving
 *       we will not silently corrupt the column.
 *
 * The (b) leg is the load-bearing one. Pre-0014 the column was `text`
 * and the writer could persist anything. Post-0014 + boundary helpers,
 * an invalid shape MUST throw at write time.
 */

import { describe, expect, it } from 'vitest';
import {
  parseAuditPayloadForWrite,
  parseDecisionInputsForRead,
  parseDecisionInputsForWrite,
  parseMigrationStepsForRead,
  parseMigrationStepsForWrite,
  parseProvisionConfigForRead,
  parseProvisionConfigForWrite,
  parseProvisionStepsForRead,
  parseProvisionStepsForWrite,
  parseRankedLendersForRead,
  parseRankedLendersForWrite,
} from './jsonb-boundary';

describe('jsonb-boundary (migration 0014)', () => {
  /* ---------- decisions.inputs_json ---------- */

  it('decisions.inputs_json — round-trips a canonical PrequalInputs', () => {
    const input = {
      tier: 'B' as const,
      ficoBand: 680,
      dti: 0.32,
      openTradelines: 7,
      amountCents: 1_500_000,
      annualIncomeCents: 9_500_000,
      state: 'TX',
      brand: 'medpay',
    };
    const written = parseDecisionInputsForWrite(input);
    const read = parseDecisionInputsForRead(written);
    expect(read).toEqual(input);
  });

  it('decisions.inputs_json — rejects negative amountCents', () => {
    expect(() =>
      parseDecisionInputsForWrite({
        tier: 'A',
        ficoBand: 720,
        dti: 0.2,
        openTradelines: 5,
        amountCents: -1,
        annualIncomeCents: 9_500_000,
        state: 'TX',
        brand: 'medpay',
      }),
    ).toThrowError(/jsonb_boundary_violation:decisions\.inputs_json:write/);
  });

  /* ---------- decisions.ranked_lenders_json ---------- */

  it('decisions.ranked_lenders_json — round-trips a ranked list', () => {
    const value = [
      {
        lenderId: 'lender_a',
        displayName: 'Lender A',
        propensityScore: 88,
        rank: 1,
        included: true,
        reasonCode: null,
        regBReasonCode: null,
        principalReasonText: null,
        estimatedAprBps: 1499,
        estimatedMaxCents: 2_000_000,
      },
      {
        lenderId: 'lender_b',
        displayName: 'Lender B',
        propensityScore: 0,
        rank: 2,
        included: false,
        reasonCode: 'fico_floor',
        regBReasonCode: 'CREDIT_HISTORY_INSUFFICIENT',
        principalReasonText: 'Insufficient credit history.',
        estimatedAprBps: null,
        estimatedMaxCents: null,
      },
    ];
    const written = parseRankedLendersForWrite(value);
    expect(parseRankedLendersForRead(written)).toEqual(value);
  });

  it('decisions.ranked_lenders_json — rejects out-of-range propensityScore', () => {
    expect(() =>
      parseRankedLendersForWrite([
        {
          lenderId: 'l',
          displayName: 'L',
          propensityScore: 150, // > 100 — boundary rejects.
          rank: 1,
          included: true,
          reasonCode: null,
          regBReasonCode: null,
          principalReasonText: null,
          estimatedAprBps: null,
          estimatedMaxCents: null,
        },
      ]),
    ).toThrowError(/ranked_lenders_json:write/);
  });

  /* ---------- audit_log.payload_json ---------- */

  it('audit_log.payload_json — accepts arbitrary objects', () => {
    const value = {
      outcome: 'success',
      from: 'enabled',
      to: 'paused',
      reason: 'pending NDA execution',
      nested: { foo: 1, bar: [true, null, 'x'] },
    };
    expect(parseAuditPayloadForWrite(value)).toEqual(value);
  });

  it('audit_log.payload_json — rejects non-object payloads', () => {
    expect(() => parseAuditPayloadForWrite('a string')).toThrowError(
      /audit_log\.payload_json:write/,
    );
    expect(() => parseAuditPayloadForWrite([1, 2, 3])).toThrowError(
      /audit_log\.payload_json:write/,
    );
  });

  /* ---------- provisioning_runs.steps_json ---------- */

  it('provisioning_runs.steps_json — round-trips ProvisionStep[]', () => {
    const value = [
      {
        name: 'highsale_subaccount' as const,
        status: 'done' as const,
        startedAt: '2026-05-01T00:00:00.000Z',
        completedAt: '2026-05-01T00:00:05.000Z',
        note: null,
        result: { subaccountId: 'hs_abc' },
      },
      {
        name: 'marketplace_defaults' as const,
        status: 'pending' as const,
        startedAt: null,
        completedAt: null,
        note: null,
        result: null,
      },
    ];
    const written = parseProvisionStepsForWrite(value);
    expect(parseProvisionStepsForRead(written)).toEqual(value);
  });

  it('provisioning_runs.steps_json — rejects unknown step name', () => {
    expect(() =>
      parseProvisionStepsForWrite([
        {
          name: 'bogus_step',
          status: 'pending',
          startedAt: null,
          completedAt: null,
          note: null,
          result: null,
        },
      ]),
    ).toThrowError(/steps_json:write/);
  });

  /* ---------- provisioning_runs.config_json ---------- */

  it('provisioning_runs.config_json — round-trips ProvisionConfig', () => {
    const value = {
      partnerId: 'partner_x',
      legalName: 'Partner X LLC',
      dba: null,
      ein: '12-3456789',
      primaryContactName: 'Jane',
      primaryContactEmail: 'jane@example.com',
      primaryContactPhone: '+15551234567',
      brand: 'medpay' as const,
      bureau: 'fico8' as const,
      monthlyPullCap: 500,
      billingCadence: 'monthly' as const,
      estimatedAnnualVolumeCents: 12_000_000_000,
      estimatedTicketCents: 250_000,
      mccCode: '8011',
      funnelUrls: ['https://example.com/apply'],
    };
    const written = parseProvisionConfigForWrite(value);
    expect(parseProvisionConfigForRead(written)).toEqual(value);
  });

  it('provisioning_runs.config_json — rejects invalid email', () => {
    expect(() =>
      parseProvisionConfigForWrite({
        partnerId: 'p',
        legalName: 'L',
        dba: null,
        ein: 'e',
        primaryContactName: 'n',
        primaryContactEmail: 'not-an-email',
        primaryContactPhone: '+15551234567',
        brand: 'medpay',
        bureau: 'fico8',
        monthlyPullCap: null,
        billingCadence: 'monthly',
        estimatedAnnualVolumeCents: 0,
        estimatedTicketCents: 0,
        mccCode: '8011',
        funnelUrls: [],
      }),
    ).toThrowError(/config_json:write/);
  });

  /* ---------- customer_migrations.step_state_json ---------- */

  it('customer_migrations.step_state_json — round-trips MigrationStepState[]', () => {
    const value = [
      {
        name: 'lookup_source' as const,
        status: 'done' as const,
        completedAt: '2026-05-01T00:00:00.000Z',
        note: null,
      },
      {
        name: 'create_partner' as const,
        status: 'pending' as const,
        completedAt: null,
        note: null,
      },
    ];
    const written = parseMigrationStepsForWrite(value);
    expect(parseMigrationStepsForRead(written)).toEqual(value);
  });

  it('customer_migrations.step_state_json — rejects non-array input', () => {
    expect(() => parseMigrationStepsForWrite({ name: 'lookup_source' })).toThrowError(
      /step_state_json:write/,
    );
  });
});
