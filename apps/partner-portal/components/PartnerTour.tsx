'use client';

/**
 * PartnerTour — first-run product tour for new brand portal users.
 *
 * Lightweight homegrown popover sequence (no new npm dependency — keeps
 * the bundle lean and avoids cross-sprint lockfile contention).
 *
 * What it does:
 *   • Walks a partner through 4 anchored steps the first time they hit
 *     their brand portal: applications inbox, team, marketplace, help.
 *   • Pins each step to a DOM node looked up by data-tour-id.
 *   • Persists "seen" state in localStorage at `partner-tour-seen-{partnerId}`.
 *   • Respects prefers-reduced-motion — no auto-pop / no scroll animation
 *     when the user opts out.
 *   • Esc / overlay click / "Skip" all complete the tour.
 *   • Sequenced focus management: each step focuses its primary CTA so
 *     keyboard-only users move through the tour with Tab/Enter.
 *
 * Wiring:
 *   • The brand-portal landing page mounts <PartnerTour partnerId=…/>.
 *   • Nav links / buttons that participate carry a `data-tour-id` attr;
 *     missing anchors are skipped silently (no thrown errors).
 *   • The reset route /admin/dev/reset-tour clears every persisted key so
 *     the operator can demo the tour for any partner.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface TourStep {
  /** data-tour-id attribute on the DOM node to anchor against. */
  anchorId: string;
  title: string;
  body: string;
}

export const PARTNER_TOUR_STEPS: TourStep[] = [
  {
    anchorId: 'nav-applications',
    title: 'Your applications inbox',
    body: 'This is your applications inbox. Every customer who submits lands here.',
  },
  {
    anchorId: 'nav-team',
    title: 'Invite your team',
    body: 'Invite your team here. Roles control who can see what.',
  },
  {
    anchorId: 'nav-marketplace',
    title: 'Pick your lenders',
    body: 'Choose which lenders show up on your apply form. Toggle on/off any time.',
  },
  {
    anchorId: 'nav-help',
    title: 'Help is one keystroke away',
    body: 'Need help? Press ? any time to see shortcuts and reach out.',
  },
];

const STORAGE_PREFIX = 'partner-tour-seen-';

export function tourStorageKey(partnerId: string): string {
  return `${STORAGE_PREFIX}${partnerId}`;
}

/** Wipe every persisted tour-seen flag — used by /admin/dev/reset-tour. */
export function clearAllPartnerTours(): number {
  if (typeof window === 'undefined') return 0;
  let cleared = 0;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) {
    window.localStorage.removeItem(k);
    cleared++;
  }
  return cleared;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(id: string): AnchorRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-tour-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export interface PartnerTourProps {
  partnerId: string;
  /** Override the canonical step list (useful for tests). */
  steps?: TourStep[];
  /** Skip the localStorage check; always fire. Used by the reset flow. */
  forceOpen?: boolean;
  /** Delay (ms) before the first popover appears so the page has rendered. */
  startDelayMs?: number;
}

export function PartnerTour({
  partnerId,
  steps = PARTNER_TOUR_STEPS,
  forceOpen = false,
  startDelayMs = 600,
}: PartnerTourProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null);

  /* Mount-time decision: should the tour fire? */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!forceOpen) {
      try {
        if (window.localStorage.getItem(tourStorageKey(partnerId)) !== null) return;
      } catch {
        /* localStorage blocked (private mode / quota) → don't fire. */
        return;
      }
    }
    const reduced = prefersReducedMotion();
    /* Respect prefers-reduced-motion: skip the auto-pop and let the user
     * trigger the tour explicitly via /admin/dev/reset-tour if they
     * want to see it. */
    if (reduced && !forceOpen) return;
    const t = window.setTimeout(() => setOpen(true), startDelayMs);
    return () => window.clearTimeout(t);
  }, [partnerId, forceOpen, startDelayMs]);

  /* Re-measure the anchor on step change + on window resize. */
  useLayoutEffect(() => {
    if (!open) return;
    const id = steps[stepIdx]?.anchorId;
    if (!id) return;
    const r = readRect(id);
    setRect(r);
    const onResize = () => setRect(readRect(id));
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, stepIdx, steps]);

  /* Move focus into the popover so keyboard users can Tab/Enter through. */
  useEffect(() => {
    if (open) dismissBtnRef.current?.focus();
  }, [open, stepIdx]);

  /* Escape closes the tour. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') complete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function persistSeen() {
    try {
      window.localStorage.setItem(tourStorageKey(partnerId), '1');
    } catch {
      /* ignore — storage blocked */
    }
  }

  function complete() {
    persistSeen();
    setOpen(false);
  }

  function next() {
    if (stepIdx + 1 >= steps.length) {
      complete();
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  function back() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  const step = steps[stepIdx];
  const popoverStyle = useMemo<React.CSSProperties>(() => {
    if (!rect) {
      /* Anchor missing — render the popover centred so the user still
       * sees the copy + can dismiss. */
      return {
        position: 'fixed',
        left: '50%',
        top: '20%',
        transform: 'translateX(-50%)',
        maxWidth: 360,
      };
    }
    const gap = 12;
    const popWidth = 320;
    /* Default: drop the popover below the anchor, anchored to its left
     * edge — clamps to viewport on the right. */
    const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.left));
    const top = rect.top + rect.height + gap;
    return {
      position: 'fixed',
      left,
      top,
      width: popWidth,
    };
  }, [rect]);

  if (!open || !step) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-tour-title"
      className="fixed inset-0 z-[60]"
    >
      {/* Backdrop — semi-transparent + click-out to dismiss. */}
      <button
        type="button"
        aria-label="Skip tour"
        onClick={complete}
        className="fixed inset-0 bg-black/40"
      />
      {/* Anchor halo — soft ring around the highlighted element. */}
      {rect && (
        <div
          aria-hidden
          className="fixed pointer-events-none rounded-md ring-2 ring-accent ring-offset-2 ring-offset-bg-elevated"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}
      {/* Popover card. */}
      <div
        style={popoverStyle}
        className="rounded-lg border border-border bg-bg-elevated text-fg shadow-2xl p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
            Step {stepIdx + 1} of {steps.length}
          </span>
          <button
            ref={dismissBtnRef}
            type="button"
            onClick={complete}
            className="text-[11px] text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm px-1"
          >
            Skip
          </button>
        </div>
        <h3 id="partner-tour-title" className="text-[14px] font-semibold text-fg">
          {step.title}
        </h3>
        <p className="mt-1 text-[12.5px] text-fg-secondary">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0}
            className="text-[12px] font-medium text-fg-secondary disabled:opacity-40 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm px-2 py-1"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center rounded-md bg-accent text-white px-3 py-1.5 text-[12px] font-medium hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {stepIdx + 1 === steps.length ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
