import type { FC, ReactNode } from 'react';
import { cn } from './cn';

/**
 * KPI card — modelled on A&E Solutions Intelligence MetricTile.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ LABEL               ↑ +22%  │  ← eyebrow label + inline delta
 *   │ $1.21M                       │  ← 20 px semibold value
 *   │ net of fees                  │  ← optional muted hint
 *   └──────────────────────────────┘
 *
 * Dense, no icon chips, no accent strips, no pill backgrounds.
 * Delta is plain coloured text aligned to the right of the label row.
 */
export const KpiCard: FC<{
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  hint?: ReactNode;
  /** @deprecated – icon chips removed to match A&E style */
  icon?: ReactNode;
  /** @deprecated – sparklines removed to match A&E style */
  series?: number[];
  className?: string;
}> = ({ label, value, delta, hint, className }) => {
  const isGood =
    delta === undefined
      ? null
      : delta.isGood !== undefined
        ? delta.isGood
        : delta.direction === 'up'
          ? true
          : delta.direction === 'down'
            ? false
            : null;

  const deltaColor =
    delta === undefined || delta.direction === 'flat'
      ? 'text-fg-muted'
      : isGood === true
        ? 'text-success'
        : isGood === false
          ? 'text-danger'
          : 'text-fg-secondary';

  const deltaArrow = delta?.direction === 'up' ? '↑' : delta?.direction === 'down' ? '↓' : '→';

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-border bg-bg-elevated px-4 py-3 shadow-sm',
        'hover:shadow-md transition-shadow duration-150',
        className,
      )}
    >
      {/* Eyebrow label + delta — same baseline row */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted font-medium">{label}</p>
        {delta && (
          <span className={cn('text-[11px] font-medium tabular-nums shrink-0', deltaColor)}>
            {deltaArrow} {delta.value}
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-[20px] font-semibold leading-tight tracking-tight tabular-nums text-fg">
        {value}
      </p>

      {/* Hint */}
      {hint && <p className="text-[11px] text-fg-muted leading-snug">{hint}</p>}
    </div>
  );
};
