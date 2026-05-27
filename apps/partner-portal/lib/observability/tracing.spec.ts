/**
 * Tests for the partner-portal OTel tracing helpers.
 *
 * Posture: these specs run in CI without a registered TracerProvider —
 * which IS the no-collector dev/CI path. The behavioural contract we
 * verify is "all helpers degrade to no-op without throwing":
 *
 *   • withSpan(...) runs the fn and returns its value.
 *   • withSpan(...) propagates throws unchanged.
 *   • recordError(...) is safe to call when no span is active.
 *   • currentTraceContext() returns null when no provider is registered.
 *   • runWithTraceContext({}) runs the fn.
 *
 * Verifying the actual span emission requires a live TracerProvider +
 * an InMemorySpanExporter; that's the territory of an integration test
 * with the SDK booted (covered manually + via Honeycomb in staging).
 */

import { describe, expect, it } from 'vitest';
import { currentTraceContext, recordError, runWithTraceContext, withSpan } from './tracing';

describe('observability/tracing — no-provider degraded mode', () => {
  it('withSpan returns the fn result on success', async () => {
    const out = await withSpan('test.span', { 'business.k': 'v' }, async () => 42);
    expect(out).toBe(42);
  });

  it('withSpan propagates throws unchanged', async () => {
    await expect(
      withSpan('test.span.fail', {}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('recordError is safe when no span is active', () => {
    expect(() => recordError(new Error('x'))).not.toThrow();
    expect(() => recordError('not-an-error')).not.toThrow();
  });

  it('currentTraceContext returns null with no provider registered', () => {
    expect(currentTraceContext()).toBeNull();
  });

  it('runWithTraceContext runs the fn even with an empty carrier', async () => {
    const out = await runWithTraceContext({}, async () => 'ok');
    expect(out).toBe('ok');
  });

  it('runWithTraceContext tolerates undefined carrier', async () => {
    const out = await runWithTraceContext(undefined, async () => 'still ok');
    expect(out).toBe('still ok');
  });
});
