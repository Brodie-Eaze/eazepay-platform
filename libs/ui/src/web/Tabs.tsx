'use client';
import type { FC, KeyboardEvent, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Underline-style tab strip. ARIA-compliant — uses the WAI-ARIA Tabs
 * pattern (`role="tablist"`, `role="tab"`, `aria-selected`,
 * roving-tabindex). Arrow-key navigation rotates focus across the
 * tablist; Enter / Space activates a tab.
 *
 * The page is responsible for rendering the corresponding `role="tabpanel"`
 * — pass `aria-labelledby={`tab-${key}`}` on the panel to associate it
 * back to its tab.
 */
export const Tabs: FC<{
  items: Array<{ key: string; label: ReactNode; count?: number }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
  /** ARIA label for the tablist. Defaults to "Tabs". */
  label?: string;
}> = ({ items, active, onChange, className, label = 'Tabs' }) => {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')
      return;
    e.preventDefault();
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = items.length - 1;
    const next = items[nextIdx];
    if (next) {
      onChange(next.key);
      // Defer focus until React rerenders the active tab.
      requestAnimationFrame(() => {
        const el = document.getElementById(`tab-${next.key}`);
        el?.focus();
      });
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex items-center gap-1 border-b border-border overflow-x-auto -mb-px',
        className,
      )}
    >
      {items.map((it, idx) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            id={`tab-${it.key}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`tabpanel-${it.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(it.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              'relative min-h-[44px] px-3 text-[13px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset',
              isActive ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {it.label}
              {typeof it.count === 'number' && (
                <span className="text-[11px] bg-bg-muted text-fg-secondary rounded-full px-1.5 py-0.5 tabular-nums">
                  {it.count}
                </span>
              )}
            </span>
            {isActive && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent rounded-full"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
