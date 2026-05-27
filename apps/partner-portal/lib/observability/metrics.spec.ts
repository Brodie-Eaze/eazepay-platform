import { describe, it, expect, beforeEach } from 'vitest';
import { incrementMetric, getMetricsSnapshot, _resetMetricsForTest } from './metrics';

/**
 * Specs for the in-process metrics module that drives
 * /admin/observability. The counter store is platform-wide (no tenant
 * scope) and monotonic until process restart, which IS the reset signal
 * we want — deploy or crash.
 */

describe('lib/observability/metrics', () => {
  beforeEach(() => {
    _resetMetricsForTest();
  });

  it('snapshot returns every known metric with a 0 default', () => {
    const snap = getMetricsSnapshot();
    expect(snap['applications.created']).toBe(0);
    expect(snap['decisions.computed']).toBe(0);
    expect(snap['webhook.queued']).toBe(0);
    expect(snap['webhook.duplicate']).toBe(0);
    expect(snap['webhook.rejected']).toBe(0);
    expect(snap['provisioning.completed']).toBe(0);
    expect(snap['provisioning.failed']).toBe(0);
    expect(snap['migration.completed']).toBe(0);
    expect(snap['migration.failed']).toBe(0);
  });

  it('incrementMetric bumps the counter by 1 by default', () => {
    incrementMetric('applications.created');
    incrementMetric('applications.created');
    incrementMetric('applications.created');
    expect(getMetricsSnapshot()['applications.created']).toBe(3);
  });

  it('incrementMetric accepts an explicit `by` value', () => {
    incrementMetric('webhook.queued', 5);
    incrementMetric('webhook.queued', 2);
    expect(getMetricsSnapshot()['webhook.queued']).toBe(7);
  });

  it('counters are independent — bumping one does not affect another', () => {
    incrementMetric('decisions.computed', 4);
    incrementMetric('webhook.duplicate', 1);
    const snap = getMetricsSnapshot();
    expect(snap['decisions.computed']).toBe(4);
    expect(snap['webhook.duplicate']).toBe(1);
    expect(snap['applications.created']).toBe(0);
  });

  it('snapshot returns a fresh object each call (no shared mutation)', () => {
    incrementMetric('migration.completed');
    const a = getMetricsSnapshot();
    incrementMetric('migration.completed');
    const b = getMetricsSnapshot();
    expect(a['migration.completed']).toBe(1);
    expect(b['migration.completed']).toBe(2);
  });

  it('_resetMetricsForTest clears every counter', () => {
    incrementMetric('webhook.rejected', 99);
    incrementMetric('provisioning.failed', 42);
    _resetMetricsForTest();
    const snap = getMetricsSnapshot();
    expect(snap['webhook.rejected']).toBe(0);
    expect(snap['provisioning.failed']).toBe(0);
  });

  it('counters are monotonic — increments only go up', () => {
    incrementMetric('webhook.queued', 10);
    incrementMetric('webhook.queued', 1);
    expect(getMetricsSnapshot()['webhook.queued']).toBe(11);
    // No `decrement` function is exposed — operators reading the dash
    // can trust the number reflects total work done since process boot.
  });

  it('snapshot order matches the catalogue order', () => {
    // The page renders tiles in a fixed order; the snapshot keys are
    // emitted in catalogue order so the UI can rely on Object.entries
    // iteration matching the catalogue list.
    const snap = getMetricsSnapshot();
    const keys = Object.keys(snap);
    expect(keys).toEqual([
      'applications.created',
      'decisions.computed',
      'decision.mode.normal',
      'decision.mode.fallback_internal',
      'decision.mode.failed_persisted_to_dlq',
      'webhook.queued',
      'webhook.duplicate',
      'webhook.rejected',
      'webhook.handler.not_implemented',
      'provisioning.completed',
      'provisioning.failed',
      'migration.completed',
      'migration.failed',
      'welcome.legacy_userid_attempt',
    ]);
  });
});
