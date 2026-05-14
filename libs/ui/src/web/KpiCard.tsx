import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { Sparkline } from './Sparkline';

export const KpiCard: FC<{
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  hint?: ReactNode;
  icon?: ReactNode;
  series?: number[];
  className?: string;
}> = ({ label, value, delta, hint, icon, series, className }) => {
  // Mono palette — direction shown via arrow + weight, not hue.
  const deltaColor = !delta
    ? ''
    : delta.direction === 'flat'
      ? 'text-fg-muted'
      : 'text-fg-secondary';
  const deltaArrow = delta?.direction === 'up' ? '↑' : delta?.direction === 'down' ? '↓' : '→';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-fg-muted font-semibold">
        {icon && <span className="text-fg-secondary">{icon}</span>}
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[20px] font-semibold leading-none tabular-nums tracking-tight">
          {value}
        </span>
        {delta && (
          <span className={cn('text-[11px] font-medium tabular-nums', deltaColor)}>
            {deltaArrow} {delta.value}
          </span>
        )}
      </div>
      {series && series.length > 1 && (
        <Sparkline data={series} height={22} className="text-accent" />
      )}
      {hint && <div className="text-[11px] text-fg-muted leading-snug">{hint}</div>}
    </div>
  );
};
