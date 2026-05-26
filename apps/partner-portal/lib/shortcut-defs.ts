/**
 * Shortcut catalogue — the single source of truth for both the
 * runtime keyboard listener (`<KeyboardShortcuts>`) and the
 * help-dialog cheat sheet (`<ShortcutsHelpDialog>`).
 *
 * Categories shown in the help dialog follow the order declared here.
 *
 * `keys` is the user-facing label (also parsed by the listener):
 *   - Single key                    →  '?'  ·  'o'  ·  'Esc'
 *   - Modifier combos               →  'cmd+K'  ·  'ctrl+K'
 *   - Two-key Linear sequences      →  'g d'  ·  'g a'  (space-separated)
 *
 * `action`:
 *   - For navigation: 'goto:<href>'
 *   - For app commands: 'open:shortcuts-help' · 'open:command-palette' etc.
 */

export interface ShortcutDef {
  keys: string;
  label: string;
  action: string;
}

export interface ShortcutGroup {
  category: 'Navigation' | 'Actions' | 'Global';
  shortcuts: ShortcutDef[];
}

export const SHORTCUT_CATALOGUE: ShortcutGroup[] = [
  {
    category: 'Global',
    shortcuts: [
      { keys: '?', label: 'Show keyboard shortcuts', action: 'open:shortcuts-help' },
      { keys: 'cmd+K', label: 'Open command palette', action: 'open:command-palette' },
      { keys: 'Esc', label: 'Close any open dialog', action: 'app:dismiss' },
    ],
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: 'g d', label: 'Go to dashboard', action: 'goto:/' },
      { keys: 'g a', label: 'Go to applications', action: 'goto:/applications' },
      { keys: 'g p', label: 'Go to partners', action: 'goto:/control-panel' },
      { keys: 'g n', label: 'Go to lender network', action: 'goto:/lender-marketplace' },
      { keys: 'g l', label: 'Go to activity log', action: 'goto:/admin/audit' },
      { keys: 'g h', label: 'Go to platform health', action: 'goto:/admin/observability' },
    ],
  },
  {
    category: 'Actions',
    shortcuts: [
      { keys: 'j', label: 'Move selection down', action: 'list:next' },
      { keys: 'k', label: 'Move selection up', action: 'list:prev' },
      { keys: 'o', label: 'Open focused item', action: 'list:open' },
      { keys: 'e', label: 'Edit focused item', action: 'list:edit' },
    ],
  },
];

/** Flat view — convenient for the runtime listener. */
export const ALL_SHORTCUTS: ShortcutDef[] = SHORTCUT_CATALOGUE.flatMap((g) => g.shortcuts);
