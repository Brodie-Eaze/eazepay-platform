import { describe, expect, it } from 'vitest';
import { MockPaymentAdapter } from '../src/adapters/mock-payment.adapter.js';

describe('MockPaymentAdapter', () => {
  const a = new MockPaymentAdapter();

  it('disburses successfully on normal amounts', async () => {
    const r = await a.disburse({
      idempotencyKey: 'key-1',
      loanId: 'loan-1',
      amountCents: 100_000n,
      destination: { kind: 'consumer_bank' },
    });
    expect(r.status).toBe('succeeded');
    expect(r.providerRef).toBe('mock-key-1');
  });

  it('forces failure on the deterministic-fail amount', async () => {
    const r = await a.disburse({
      idempotencyKey: 'key-2',
      loanId: 'loan-2',
      amountCents: 10_001n, // % 10000 === 1 → fail
      destination: {},
    });
    expect(r.status).toBe('failed');
    if (r.status === 'failed') expect(r.reasonCode).toBe('mock_force_fail');
  });

  it('debits with same shape', async () => {
    const r = await a.debit({
      idempotencyKey: 'key-3',
      loanId: 'loan-3',
      paymentMethodId: 'pm-1',
      providerToken: 'tok-1',
      amountCents: 200_000n,
    });
    expect(r.status).toBe('succeeded');
  });
});
