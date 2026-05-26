'use client';
/**
 * KeyboardShortcuts — global `keydown` listener that turns the
 * shortcut catalogue (`lib/shortcut-defs.ts`) into actions:
 *
 *   - Single keys (`?`, `j`, `k`, `o`, `e`) dispatch immediately.
 *   - Two-key Linear sequences (`g d`, `g a` …) route through the
 *     pure state-machine in `lib/shortcut-machine.ts`. The first key
 *     arms a "leader" state with a 1s timeout; the second key
 *     dispatches.
 *   - cmd/ctrl-K is owned by `<CommandPalette>` itself (no change).
 *   - Esc is owned by each individual dialog (Radix Dialog,
 *     CommandPalette) — we don't intercept it here to avoid
 *     fighting Radix's outside-click/Escape handling.
 *
 * Hard skip rule: if the active element is an `<input>`,
 * `<textarea>`, or `[contenteditable]`, every key passes through to
 * the field. Operators must be able to type "g" in the search box.
 *
 * Mounting: rendered once at `app/_shell.tsx`. It owns the
 * `<ShortcutsHelpDialog>` state and listens for an
 * `eazepay:open-shortcuts-help` CustomEvent so the MoreMenu (and any
 * other off-tree UI) can pop the dialog without prop drilling.
 *
 * List-action shortcuts (`j` / `k` / `o` / `e`) fire CustomEvents
 * (`eazepay:list-next`, `eazepay:list-prev`, `eazepay:list-open`,
 * `eazepay:list-edit`). List surfaces opt in by listening; surfaces
 * that don't care silently ignore them. This keeps the shortcut
 * layer decoupled from any particular table implementation.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildMap, idleState, step, type ShortcutMachineState } from '../lib/shortcut-machine';
import { ALL_SHORTCUTS } from '../lib/shortcut-defs';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';

/* Map of single-key bindings (entries with `keys` that is a single
 * printable character, OR a single `?`). The two-key sequences are
 * pulled out separately for the state machine. */
const sequenceDefs = ALL_SHORTCUTS.filter((s) => /\s/.test(s.keys));
const singleKeyDefs = ALL_SHORTCUTS.filter(
  (s) => !/\s/.test(s.keys) && !s.keys.includes('+') && s.keys.length <= 4,
);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const stateRef = useRef<ShortcutMachineState>(idleState());

  useEffect(() => {
    const map = buildMap(sequenceDefs.map((s) => ({ keys: s.keys, action: s.action })));

    const dispatch = (action: string) => {
      if (action.startsWith('goto:')) {
        const href = action.slice('goto:'.length);
        router.push(href);
        return;
      }
      if (action === 'open:shortcuts-help') {
        setHelpOpen(true);
        return;
      }
      if (action === 'list:next') {
        window.dispatchEvent(new CustomEvent('eazepay:list-next'));
        return;
      }
      if (action === 'list:prev') {
        window.dispatchEvent(new CustomEvent('eazepay:list-prev'));
        return;
      }
      if (action === 'list:open') {
        window.dispatchEvent(new CustomEvent('eazepay:list-open'));
        return;
      }
      if (action === 'list:edit') {
        window.dispatchEvent(new CustomEvent('eazepay:list-edit'));
        return;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Pass through every key when typing in an editable field.
      if (isEditable(e.target)) return;
      // Modifier-key combos belong to the components that own them
      // (cmd-K → CommandPalette). We only handle bare keys here.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Long key names (Shift / Enter / Tab / arrows) skip the
      // state machine — they're not part of our catalogue and we
      // don't want to swallow them.
      if (e.key.length > 1) return;

      // 1) Single-key bindings first (e.g. '?', 'o', 'e', 'j', 'k').
      const single = singleKeyDefs.find((s) => s.keys === e.key);
      if (single) {
        e.preventDefault();
        // Reset any pending leader so single-key actions don't leave
        // the machine half-armed.
        stateRef.current = idleState();
        dispatch(single.action);
        return;
      }

      // 2) Two-key Linear sequences via the state machine.
      const result = step(stateRef.current, e.key, map, Date.now());
      stateRef.current = result.next;
      if (result.type === 'dispatch') {
        e.preventDefault();
        dispatch(result.action);
      }
      // leader-armed / idle: no DOM side effects.
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [router]);

  // External callers (MoreMenu) can open the help dialog by firing
  // an event — no need to plumb setHelpOpen across the tree.
  useEffect(() => {
    const onOpen = () => setHelpOpen(true);
    window.addEventListener('eazepay:open-shortcuts-help', onOpen);
    return () => window.removeEventListener('eazepay:open-shortcuts-help', onOpen);
  }, []);

  return <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}
