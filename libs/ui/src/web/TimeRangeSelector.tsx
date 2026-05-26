'use client';
import { useCallback, type FC } from 'react';
import { cn } from './cn';

/**
 * TimeRangeSelector — canonical dashboard time-window picker.
 *
 * WHY:
 *   Every dashboard in the partner-portal needs the same "7d · 30d · 90d ·
 *   12m · all" window switch. Inlining the same six buttons everywhere
 *   creates drift (button sizes don't match, the "active" state diverges,
 *   one page persists in URL state and another doesn't). This component
 *   is the single source of truth.
 *
 * URL persistence:
 *   We intentionally DON'T touch `useSearchParams` / `useRouter` here. The
 *   shared web bundle has to work outside Next.js (storybook, marketing
 *   site, future apps). Instead callers pass `value` + `onChange` and own
 *   the URL writeback. The recommended pattern is:
 *
 *     const sp = useSearchParams();
 *     const router = useRouter();
 *     const range = (sp.get('range') as TimeRange) ?? '30d';
 *     <TimeRangeSelector value={range} onChange={(r) => {
 *       const params = new URLSearchParams(sp);
 *       params.set('range', r);
 *       router.replace(`?${params.toString()}`, { scroll: false });
 *     }} />
 *
 *   See `lib/dashboard-metrics.ts` → `timeRangeToWindow()` for the
 *   matching window computation.
 */

export const TIME_RANGES = ['7d', '30d', '90d', '12m', 'all'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

const LABELS: Record<TimeRange, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '12m': '12m',
  all: 'All',
};

const FULL_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  all: 'All time',
};

export const TimeRangeSelector: FC<{
  value: TimeRange;
  onChange: (next: TimeRange) => void;
  className?: string;
  /** Visible legend text. Default 'Range'. */
  label?: string;
}> = ({ value, onChange, className, label = 'Range' }) => {
  const handle = useCallback(
    (r: TimeRange) => () => {
      if (r !== value) onChange(r);
    },
    [value, onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-bg-elevated p-0.5 shadow-sm',
        className,
      )}
    >
      {TIME_RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={FULL_LABELS[r]}
            onClick={handle(r)}
            className={cn(
              'min-w-[36px] px-2.5 py-1 text-[11px] font-semibold tabular-nums rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              active
                ? 'bg-fg text-bg-elevated'
                : 'text-fg-muted hover:text-fg hover:bg-bg-muted/60',
            )}
          >
            {LABELS[r]}
          </button>
        );
      })}
    </div>
  );
};
