import { describe, it, expect } from 'vitest';
import { buildMap, idleState, step, DEFAULT_TIMEOUT_MS } from './shortcut-machine';

const defs = [
  { keys: 'g d', action: 'goto:dashboard' },
  { keys: 'g a', action: 'goto:applications' },
  { keys: 'g p', action: 'goto:partners' },
];

const map = buildMap(defs);

describe('shortcut-machine.buildMap', () => {
  it('extracts every leader key', () => {
    expect(map.leaders.has('g')).toBe(true);
    expect(map.leaders.size).toBe(1);
  });

  it('maps every sequence to its action', () => {
    expect(map.sequences.get('g+d')).toBe('goto:dashboard');
    expect(map.sequences.get('g+a')).toBe('goto:applications');
    expect(map.sequences.get('g+p')).toBe('goto:partners');
  });

  it('ignores malformed defs (not exactly 2 keys)', () => {
    const m = buildMap([
      { keys: 'g', action: 'noop' },
      { keys: 'g d x', action: 'noop' },
      { keys: 'g a', action: 'goto:applications' },
    ]);
    expect(m.sequences.size).toBe(1);
    expect(m.sequences.get('g+a')).toBe('goto:applications');
  });
});

describe('shortcut-machine.step', () => {
  it('arms the leader on first key', () => {
    const r = step(idleState(), 'g', map, 1000);
    expect(r.type).toBe('leader-armed');
    expect(r.next.leader).toBe('g');
    expect(r.next.expiresAt).toBe(1000 + DEFAULT_TIMEOUT_MS);
  });

  it('dispatches when follower lands in time', () => {
    const armed = step(idleState(), 'g', map, 1000);
    const r = step(armed.next, 'd', map, 1500);
    expect(r.type).toBe('dispatch');
    if (r.type === 'dispatch') {
      expect(r.action).toBe('goto:dashboard');
    }
    expect(r.next.leader).toBeNull();
  });

  it('resets to idle when leader expires before follower', () => {
    const armed = step(idleState(), 'g', map, 1000);
    // Wait past timeout
    const r = step(armed.next, 'd', map, 1000 + DEFAULT_TIMEOUT_MS + 1);
    // Expired: 'd' isn't a leader, so we go idle.
    expect(r.type).toBe('idle');
    expect(r.next.leader).toBeNull();
  });

  it('re-arms when a non-binding follower is itself a leader', () => {
    const armed = step(idleState(), 'g', map, 1000);
    // 'g' as follower: not a sequence, but IS a leader → re-arm.
    const r = step(armed.next, 'g', map, 1100);
    expect(r.type).toBe('leader-armed');
    expect(r.next.leader).toBe('g');
  });

  it('drops to idle when armed and follower is unbound non-leader', () => {
    const armed = step(idleState(), 'g', map, 1000);
    const r = step(armed.next, 'z', map, 1100);
    expect(r.type).toBe('idle');
  });

  it('ignores non-leader keys when idle', () => {
    const r = step(idleState(), 'z', map, 1000);
    expect(r.type).toBe('idle');
    expect(r.next.leader).toBeNull();
  });
});
