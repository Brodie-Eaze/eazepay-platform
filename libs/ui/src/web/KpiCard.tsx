import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { Sparkline } from './Sparkline';

/**
 * KPI card — Door 2 Digital / A&E Solutions Intelligence style.
 *
 * Layout:
 *   ┌────────────────────────────┐
 *   │ LABEL                      │  ← 10px caps eyebrow
 *   │ $1.21M                     │  ← 20px semibold value
 *   │ ↑ +22%                     │  ← plain coloured delta (no pill bg)
 *   │ net of fees                │  ← optional muted hint
 *   │ ▁▂▃▅▄▆                     │  ← optional sparkline
 *   └────────────────────────────┘
 *
 * No accent strips. No icon chips. No pill/chip backgrounds on delta.
 * Delta is plain coloured text sitting below the value.
 */
export const KpiCard: FC<{
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  hint?: ReactNode;
  series?: number[];
  /** @deprecated – icon chips removed */
  icon?: ReactNode;
  className?: string;
}> = ({ label, value, delta, hint, series, className }) => {
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

  const sparklineColor =
    isGood === true ? 'text-success' : isGood === false ? 'text-danger' : 'text-fg-secondary';

  const deltaArrow = delta?.direction === 'up' ? '↑' : delta?.direction === 'down' ? '↓' : '→';

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-border bg-bg-elevated px-4 py-3.5 shadow-sm',
        'hover:shadow-md transition-shadow duration-150',
        className,
      )}
    >
      {/* Eyebrow */}
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-fg-muted">{label}</p>

      {/* Value */}
      <p className="text-[24px] font-bold leading-tight tracking-tight tabular-nums text-fg">
        {value}
      </p>

      {/* Delta — plain coloured text, no background */}
      {delta && (
        <p className={cn('text-[11px] font-semibold tabular-nums leading-none', deltaColor)}>
          {deltaArrow} {delta.value}
        </p>
      )}

      {/* Hint */}
      {hint && <p className="text-[11px] text-fg-muted leading-snug mt-0.5">{hint}</p>}

      {/* Sparkline */}
      {series && series.length > 1 && (
        <div className={cn('mt-2', sparklineColor)}>
          <Sparkline data={series} width={120} height={28} />
        </div>
      )}
    </div>
  );
};
