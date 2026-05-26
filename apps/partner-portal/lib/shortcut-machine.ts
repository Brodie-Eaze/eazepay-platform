/**
 * Two-key leader sequence state machine — Linear-style `g d`, `g a`
 * shortcuts. Pure functions so we can exercise them in vitest without
 * a DOM.
 *
 * Lifecycle:
 *   idle  --(leader key)--> leader('g', expires=ts+timeoutMs)
 *   leader --(follower key within timeout)--> dispatch + idle
 *   leader --(follower key after timeout, or non-binding key)--> idle
 *
 * The caller owns the wall clock — `step()` takes a `now` so we can
 * fast-forward deterministically in tests. In the runtime listener
 * we pass `Date.now()`.
 */

export interface ShortcutMachineState {
  /** The pending leader key (e.g. 'g'), or null if idle. */
  leader: string | null;
  /** ms-since-epoch at which the leader expires. */
  expiresAt: number;
}

export interface ShortcutMap {
  /** First key of a sequence (e.g. 'g'). */
  leaders: Set<string>;
  /** Map of "leader+follower" → action id (e.g. 'g+d' → 'goto:dashboard'). */
  sequences: Map<string, string>;
}

export type StepResult =
  | { type: 'idle'; next: ShortcutMachineState }
  | { type: 'leader-armed'; next: ShortcutMachineState }
  | { type: 'dispatch'; action: string; next: ShortcutMachineState };

export const DEFAULT_TIMEOUT_MS = 1000;

export const idleState = (): ShortcutMachineState => ({
  leader: null,
  expiresAt: 0,
});

/**
 * Build a ShortcutMap from a flat list of "g d" / "?" definitions.
 * Single-key entries are excluded from this leader-machine and are
 * handled separately by the caller (those don't need state).
 */
export function buildMap(defs: Array<{ keys: string; action: string }>): ShortcutMap {
  const leaders = new Set<string>();
  const sequences = new Map<string, string>();
  for (const def of defs) {
    const parts = def.keys.split(/\s+/);
    if (parts.length !== 2) continue;
    const [a, b] = parts as [string, string];
    leaders.add(a);
    sequences.set(`${a}+${b}`, def.action);
  }
  return { leaders, sequences };
}

/**
 * Feed one keystroke through the machine. Returns the next state +
 * whether an action should dispatch.
 *
 *   - Modifier keys / non-printables (length > 1 like 'Shift') are
 *     ignored upstream by the listener; we expect single-char keys
 *     here.
 *   - If the leader is set but expired, treat this key as a fresh
 *     attempt.
 */
export function step(
  state: ShortcutMachineState,
  key: string,
  map: ShortcutMap,
  now: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): StepResult {
  // Expire stale leader.
  const armed = state.leader !== null && now < state.expiresAt ? state.leader : null;

  if (armed) {
    const combo = `${armed}+${key}`;
    const action = map.sequences.get(combo);
    if (action) {
      return { type: 'dispatch', action, next: idleState() };
    }
    // Not a valid follower — reset to idle, but allow the key itself
    // to start a new leader if it qualifies.
    if (map.leaders.has(key)) {
      return {
        type: 'leader-armed',
        next: { leader: key, expiresAt: now + timeoutMs },
      };
    }
    return { type: 'idle', next: idleState() };
  }

  if (map.leaders.has(key)) {
    return {
      type: 'leader-armed',
      next: { leader: key, expiresAt: now + timeoutMs },
    };
  }
  return { type: 'idle', next: idleState() };
}
