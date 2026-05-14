import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { AlertIcon, CheckIcon, InfoIcon } from './Icon';

export type BannerIntent = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<BannerIntent, { bg: string; border: string; text: string; icon: ReactNode }> = {
  info: {
    bg: 'bg-info-bg',
    border: 'border-info/30',
    text: 'text-info',
    icon: <InfoIcon size={16} />,
  },
  success: {
    bg: 'bg-success-bg',
    border: 'border-success/30',
    text: 'text-success',
    icon: <CheckIcon size={16} />,
  },
  warning: {
    bg: 'bg-warning-bg',
    border: 'border-warning/30',
    text: 'text-warning',
    icon: <AlertIcon size={16} />,
  },
  danger: {
    bg: 'bg-danger-bg',
    border: 'border-danger/30',
    text: 'text-danger',
    icon: <AlertIcon size={16} />,
  },
};

export const Banner: FC<{
  intent?: BannerIntent;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}> = ({ intent = 'info', title, children, action, className }) => {
  const t = tones[intent];
  return (
    <div
      role="alert"
      className={cn('rounded-md border p-3 flex items-start gap-3', t.bg, t.border, className)}
    >
      <span className={cn('mt-0.5 shrink-0', t.text)}>{t.icon}</span>
      <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
        {title && <div className={cn('font-semibold', t.text)}>{title}</div>}
        {children && <div className="text-fg-secondary mt-0.5">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
