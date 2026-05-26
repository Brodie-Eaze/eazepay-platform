import { describe, it, expect } from 'vitest';
import { extractProviderEventId } from './webhook-processor';

/**
 * Hermetic specs for the webhook processor's pure helpers. The inbox
 * dispatch path itself needs a live Postgres, which the vitest harness
 * does not provide today (see vitest.config.ts — `lib/**` only) — that
 * coverage is in the e2e suite.
 */
describe('extractProviderEventId', () => {
  it('returns null when neither id nor event_id is present', () => {
    expect(extractProviderEventId({})).toBeNull();
    expect(extractProviderEventId({ type: 'mid.underwriting.approved' })).toBeNull();
  });

  it('prefers `id` over `event_id` (MiCamp convention)', () => {
    expect(extractProviderEventId({ id: 'evt_micamp_abc', event_id: 'evt_other' })).toBe(
      'evt_micamp_abc',
    );
  });

  it('falls back to `event_id` when `id` is absent (HighSale convention)', () => {
    expect(extractProviderEventId({ event_id: 'evt_highsale_xyz' })).toBe('evt_highsale_xyz');
  });

  it('falls back to camelCase `eventId` for providers that use it', () => {
    expect(extractProviderEventId({ eventId: 'evt_camel_001' })).toBe('evt_camel_001');
  });

  it('coerces numeric ids to strings', () => {
    expect(extractProviderEventId({ id: 42 })).toBe('42');
  });

  it('rejects empty-string ids', () => {
    expect(extractProviderEventId({ id: '' })).toBeNull();
  });

  it('rejects boolean / object / array values at the id key', () => {
    expect(extractProviderEventId({ id: true })).toBeNull();
    expect(extractProviderEventId({ id: { nested: 'x' } })).toBeNull();
    expect(extractProviderEventId({ id: ['x'] })).toBeNull();
  });

  it('rejects NaN / Infinity numeric ids', () => {
    expect(extractProviderEventId({ id: Number.NaN })).toBeNull();
    expect(extractProviderEventId({ id: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
