'use client';
/**
 * BackButton — small ghost chip that goes back one step in browser
 * history. Lives inside `PageHeader` (one per page) so operators can
 * always retreat without hunting for the sidebar or the browser's own
 * back button.
 *
 * Behaviour:
 *   - On click → `window.history.back()`.
 *   - Auto-hides on the root path (`/`) where there's nothing to go
 *     back to inside the app.
 *   - Renders nothing during SSR (the back-affordance is a runtime
 *     concept; rendering it before hydration would tease an action the
 *     user can't yet trigger).
 */
import { useEffect, useState } from 'react';

interface BackButtonProps {
  /** Suppress on specific paths (in addition to the default '/'). */
  hiddenOn?: ReadonlyArray<string>;
  className?: string;
}

export function BackButton({ hiddenOn = [], className }: BackButtonProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [path, setPath] = useState('/');
  useEffect(() => {
    setMounted(true);
    setPath(window.location.pathname);
  }, []);
  if (!mounted) return null;
  if (path === '/' || hiddenOn.includes(path)) return null;
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className={
        'inline-flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ' +
        'focus-visible:ring-offset-1 rounded-sm transition-colors ' +
        (className ?? '')
      }
      aria-label="Go back"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      <span>Back</span>
    </button>
  );
}
