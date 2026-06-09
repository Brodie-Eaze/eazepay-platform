import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export const KpiCard: FC<{
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  hint?: ReactNode;
  icon?: ReactNode;
  series?: number[];
  className?: string;
}> = ({ label, value, delta, hint, icon, className }) => {
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

  const accentStrip =
    isGood === true ? 'bg-success/50' : isGood === false ? 'bg-danger/50' : 'bg-accent/50';

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

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border',
        'bg-bg-elevated px-4 py-4 shadow-sm',
        'hover:shadow-md hover:border-border-strong transition-all duration-200',
        className,
      )}
    >
      {/* 3 px semantic accent strip */}
      <div className={cn('absolute inset-x-0 top-0 h-[3px]', accentStrip)} />

      {/* Label + icon chip */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-fg-muted font-semibold">
          {label}
        </p>
        {icon && (
          <span className="flex items-center justify-center size-7 rounded-lg bg-accent-soft text-accent shrink-0">
            {icon}
          </span>
        )}
      </div>

      {/* Value + delta */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[22px] font-bold leading-none tabular-nums tracking-tight text-fg">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
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
  );
};
