'use client';
/**
 * ShortcutsHelpDialog — `?` cheat sheet listing every registered
 * keyboard shortcut, grouped by category. Opened by the global `?`
 * shortcut in `<KeyboardShortcuts>` and from the topbar MoreMenu.
 *
 * The shortcut catalogue here is the source of truth — both the
 * runtime listener and this dialog import the same array. If you
 * add a shortcut, add it once in `lib/shortcut-defs.ts`.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@eazepay/ui/web';
import { SHORTCUT_CATALOGUE } from '../lib/shortcut-defs';

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move around the operating system without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          {SHORTCUT_CATALOGUE.map((group) => (
            <section key={group.category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
                {group.category}
              </h3>
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {group.shortcuts.map((s) => (
                  <li key={s.keys} className="flex items-center justify-between gap-4 px-3 py-2">
                    <span className="text-[13px] text-fg">{s.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.split(/\s+/).map((k, i) => (
                        <kbd
                          key={`${k}-${i}`}
                          className="text-[11px] font-mono text-fg-secondary border border-border rounded px-1.5 py-0.5 bg-bg-muted/40"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
