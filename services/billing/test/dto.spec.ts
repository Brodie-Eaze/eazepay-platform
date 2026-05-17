import { describe, expect, it } from 'vitest';
import { BillingConfigPatchSchema } from '../src/dto/billing-config.dto.js';
import {
  ConfirmDecisionSchema,
  GenerateBatchSchema,
  ListInvoicesQuerySchema,
  RecordPaymentSchema,
  SetAmountSchema,
  SetDueDateSchema,
  SetFeePctSchema,
  SetStatusSchema,
  VoidInvoiceSchema,
} from '../src/dto/invoice.dto.js';

/**
 * DTO contract tests — the Zod schemas are the security boundary.
 * If a hostile client can sneak unknown fields, oversized strings, or
 * wrong types past these, the service is exposed. Tests pin the
 * bounds we care about.
 */

describe('BillingConfigPatchSchema', () => {
  it('accepts valid patches', () => {
    expect(
      BillingConfigPatchSchema.parse({
        cycle: 'monthly',
        dayOfPeriod: 15,
        sendToEmail: 'finance@example.com',
        autoSend: true,
        paymentLinkTemplate: 'https://pay.stripe.com/inv/{{invoice}}',
      }).cycle,
    ).toBe('monthly');
  });

  it('clamps dayOfPeriod to 0-28 (avoids 29-31 short-month edge cases)', () => {
    expect(() => BillingConfigPatchSchema.parse({ dayOfPeriod: -1 })).toThrow();
    expect(() => BillingConfigPatchSchema.parse({ dayOfPeriod: 31 })).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() => BillingConfigPatchSchema.parse({ cycle: 'monthly', injected: 'bad' })).toThrow();
  });

  it('accepts empty-string sendToEmail (caller convention for "clear")', () => {
    expect(BillingConfigPatchSchema.parse({ sendToEmail: '' }).sendToEmail).toBe('');
  });

  it('rejects malformed emails', () => {
    expect(() => BillingConfigPatchSchema.parse({ sendToEmail: 'not-an-email' })).toThrow();
  });

  it('caps paymentLinkTemplate length so it cannot be abused as bulk storage', () => {
    expect(() =>
      BillingConfigPatchSchema.parse({ paymentLinkTemplate: 'x'.repeat(1025) }),
    ).toThrow();
  });
});

describe('GenerateBatchSchema', () => {
  it('requires YYYY-MM periodId', () => {
    expect(GenerateBatchSchema.parse({ periodId: '2026-05' }).periodId).toBe('2026-05');
    expect(() => GenerateBatchSchema.parse({ periodId: '2026/05' })).toThrow();
    expect(() => GenerateBatchSchema.parse({})).toThrow();
  });
});

describe('SetFeePctSchema', () => {
  it('caps fee at 50%', () => {
    expect(SetFeePctSchema.parse({ feePct: 3.5 }).feePct).toBe(3.5);
    expect(() => SetFeePctSchema.parse({ feePct: -0.1 })).toThrow();
    expect(() => SetFeePctSchema.parse({ feePct: 50.01 })).toThrow();
  });
});

describe('SetStatusSchema', () => {
  it('rejects voided as a settable status (only the dedicated void endpoint can void)', () => {
    expect(() => SetStatusSchema.parse({ status: 'voided' })).toThrow();
    expect(SetStatusSchema.parse({ status: 'paid' }).status).toBe('paid');
  });
});

describe('SetAmountSchema', () => {
  it('rejects negative amounts and over-trillion values', () => {
    expect(() => SetAmountSchema.parse({ amountCents: -1 })).toThrow();
    expect(() => SetAmountSchema.parse({ amountCents: 1_000_000_000_001 })).toThrow();
  });
});

describe('SetDueDateSchema', () => {
  it('requires YYYY-MM-DD', () => {
    expect(SetDueDateSchema.parse({ dueDate: '2026-05-31' }).dueDate).toBe('2026-05-31');
    expect(() => SetDueDateSchema.parse({ dueDate: '5/31/26' })).toThrow();
  });
});

describe('VoidInvoiceSchema', () => {
  it('requires non-empty reason', () => {
    expect(() => VoidInvoiceSchema.parse({ reason: '' })).toThrow();
    expect(VoidInvoiceSchema.parse({ reason: 'duplicate' }).reason).toBe('duplicate');
  });
});

describe('RecordPaymentSchema', () => {
  it('requires positive amount + valid method + ISO date', () => {
    const ok = {
      amountCents: 100,
      paidAt: '2026-05-17',
      method: 'ach' as const,
    };
    expect(RecordPaymentSchema.parse(ok).method).toBe('ach');
    expect(() => RecordPaymentSchema.parse({ ...ok, amountCents: 0 })).toThrow();
    expect(() => RecordPaymentSchema.parse({ ...ok, method: 'wire-transfer' })).toThrow();
  });
});

describe('ConfirmDecisionSchema', () => {
  it('accepts confirm without reason and dispute with one', () => {
    expect(ConfirmDecisionSchema.parse({ decision: 'confirm' }).decision).toBe('confirm');
    expect(
      ConfirmDecisionSchema.parse({ decision: 'dispute', reason: 'wrong amount' }).reason,
    ).toBe('wrong amount');
  });

  it('caps reason at 2000 chars', () => {
    expect(() =>
      ConfirmDecisionSchema.parse({ decision: 'dispute', reason: 'x'.repeat(2001) }),
    ).toThrow();
  });
});

describe('ListInvoicesQuerySchema', () => {
  it('caps limit at 200', () => {
    expect(ListInvoicesQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(() => ListInvoicesQuerySchema.parse({ limit: 500 })).toThrow();
  });

  it('defaults limit to 100', () => {
    expect(ListInvoicesQuerySchema.parse({}).limit).toBe(100);
  });
});
