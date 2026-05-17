import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-bg-muted text-fg-secondary border-border',
  info: 'bg-info-bg text-info border-info/30',
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
  accent: 'bg-accent-soft text-accent border-accent/20',
};

export const StatusPill: FC<{
  tone?: StatusTone;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}> = ({ tone = 'neutral', dot, icon, children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5',
      toneClasses[tone],
      className,
    )}
  >
    {dot && <span className="size-1.5 rounded-full bg-current" />}
    {icon}
    {children}
  </span>
);
