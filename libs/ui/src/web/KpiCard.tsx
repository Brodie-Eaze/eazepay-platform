import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { Sparkline } from './Sparkline';

/**
 * Premium fintech KPI card.
 *
 * Design decisions:
 * - 3 px semantic accent strip at top (success / danger / accent by delta direction)
 * - Icon rendered as a coloured chip (bg-accent-soft) rather than a raw glyph
 * - Value at 30 px bold — must read from across a dashboard
 * - Delta as a small pill with background tint so green ≠ grey ≠ red at a glance
 * - Sparkline follows delta semantic colour
 * - Hover lifts shadow + tightens border to signal interactivity
 */
export const KpiCard: FC<{
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  hint?: ReactNode;
  icon?: ReactNode;
  series?: number[];
  className?: string;
}> = ({ label, value, delta, hint, icon, series, className }) => {
  // Determine if the delta is semantically positive/negative.
  // Prefer the explicit `isGood` flag; fall back to direction heuristic.
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

  // Top accent strip colour
  const accentStrip =
    isGood === true ? 'bg-success/50' : isGood === false ? 'bg-danger/50' : 'bg-accent/50';

  // Delta pill colours
  const deltaPillBg =
    delta === undefined
      ? ''
      : isGood === true
        ? 'bg-success-bg'
        : isGood === false
          ? 'bg-danger-bg'
          : 'bg-bg-muted';

  const deltaPillText =
    delta === undefined
      ? ''
      : delta.direction === 'flat'
        ? 'text-fg-muted'
        : isGood === true
          ? 'text-success'
          : isGood === false
            ? 'text-danger'
            : 'text-fg-secondary';

  const deltaArrow = delta?.direction === 'up' ? '↑' : delta?.direction === 'down' ? '↓' : '→';

  // Sparkline tint follows the same semantic
  const sparklineClass =
    isGood === false ? 'text-danger' : isGood === true ? 'text-success' : 'text-accent';

  return (
    <div
      className={cn(
        // Layout + shape
        'group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border',
        // Background + elevation
        'bg-bg-elevated px-5 py-5 shadow-sm',
        // Hover
        'hover:shadow-md hover:border-border-strong transition-all duration-200',
        className,
      )}
    >
      {/* 3 px semantic accent strip */}
      <div className={cn('absolute inset-x-0 top-0 h-[3px]', accentStrip)} />

      {/* Header: label + icon chip */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold">
          {label}
        </p>
        {icon && (
          <span className="flex items-center justify-center size-8 rounded-lg bg-accent-soft text-accent shrink-0">
            {icon}
          </span>
        )}
      </div>

      {/* Value + delta pill */}
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-fg">
            {value}
          </span>
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5',
                'text-[11px] font-semibold tabular-nums',
                deltaPillBg,
                deltaPillText,
              )}
            >
              {deltaArrow} {delta.value}
            </span>
          )}
        </div>
        {hint && <p className="text-[11px] text-fg-muted leading-snug">{hint}</p>}
      </div>

      {/* Sparkline */}
      {series && series.length > 1 && (
        <Sparkline data={series} height={26} className={cn(sparklineClass, 'opacity-75')} />
      )}
    </div>
  );
};
