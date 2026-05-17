import { describe, it, expect } from 'vitest';
import { MockEmailAdapter } from '../src/adapters/mock-email.adapter.js';

describe('MockEmailAdapter', () => {
  it('returns sent + a synthetic providerMessageId', async () => {
    const adapter = new MockEmailAdapter();
    const result = await adapter.send({
      from: 'noreply@medpay.eazepay.com',
      to: 'a@b.test',
      subject: 'hi',
      text: 'hi',
      html: '<p>hi</p>',
      idempotencyKey: 'k1',
    });
    expect(result.provider).toBe('mock');
    expect(result.providerMessageId).toMatch(/^mock-/);
  });

  it('deduplicates by idempotencyKey within the same process', async () => {
    const adapter = new MockEmailAdapter();
    const a = await adapter.send({
      from: 'x',
      to: 'a@b.test',
      subject: 'hi',
      text: '',
      html: '',
      idempotencyKey: 'dup-key',
    });
    const b = await adapter.send({
      from: 'x',
      to: 'a@b.test',
      subject: 'hi',
      text: '',
      html: '',
      idempotencyKey: 'dup-key',
    });
    expect(a.providerMessageId).not.toBe(b.providerMessageId);
    expect(b.providerMessageId).toMatch(/^mock-dup-/);
  });
});
