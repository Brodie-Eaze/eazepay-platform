import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from './Icon';

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

/**
 * Standardised inline alert / notice. ARIA semantics auto-adapt to
 * intent:
 *   - `danger` / `warning` → `role="alert"` + `aria-live="assertive"`
 *     so screen-readers interrupt the current utterance.
 *   - `info` / `success` → `role="status"` + `aria-live="polite"` so
 *     non-urgent messages queue politely.
 * Passing `onDismiss` adds a real `<button>` with a `Dismiss` label so
 * the message can be cleared by keyboard. Title + body are both
 * announced as one block.
 */
export const Banner: FC<{
  intent?: BannerIntent;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  onDismiss?: () => void;
}> = ({ intent = 'info', title, children, action, className, onDismiss }) => {
  const t = tones[intent];
  const isUrgent = intent === 'danger' || intent === 'warning';
  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn('rounded-md border p-3 flex items-start gap-3', t.bg, t.border, className)}
    >
      <span className={cn('mt-0.5 shrink-0', t.text)} aria-hidden>
        {t.icon}
      </span>
      <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
        {title && <div className={cn('font-semibold', t.text)}>{title}</div>}
        {children && <div className="text-fg-secondary mt-0.5">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 inline-flex items-center justify-center h-7 w-7 rounded-md text-fg-secondary hover:text-fg hover:bg-bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
};
