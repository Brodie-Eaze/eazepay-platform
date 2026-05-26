import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export type EmptyStateVariant = 'default' | 'inline';

export interface EmptyStateProps {
  /** Visual mark — an icon from @eazepay/ui/web icons, OR a custom SVG illustration. */
  icon?: ReactNode;
  /** 1-line teaching headline. Short. */
  title: ReactNode;
  /** Optional 1-paragraph context. */
  description?: ReactNode;
  /** Primary action — usually a Button or Link. */
  action?: ReactNode;
  /** Optional secondary action (link to docs / help). */
  secondaryAction?: ReactNode;
  /** Style: 'default' (centered, large) · 'inline' (smaller, for inside tables / cards) */
  variant?: EmptyStateVariant;
  className?: string;
}

/**
 * Pure helpers — exported for hermetic node specs. Each function returns the
 * className it would apply for the given variant so the spec suite can
 * assert the variant→class contract without booting a DOM.
 */
export function emptyStateContainerClasses(variant: EmptyStateVariant): string {
  const base =
    'flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border bg-bg-elevated/30';
  const size = variant === 'inline' ? 'px-4 py-8' : 'px-6 py-14';
  return `${base} ${size}`;
}

export function emptyStateIconWrapClasses(variant: EmptyStateVariant): string {
  const size = variant === 'inline' ? 'size-9 mb-3' : 'size-12 mb-4';
  return `${size} rounded-full bg-bg-muted flex items-center justify-center text-fg-muted`;
}

export function emptyStateTitleClasses(variant: EmptyStateVariant): string {
  return variant === 'inline'
    ? 'text-[13px] font-semibold text-fg'
    : 'text-[15px] font-semibold text-fg';
}

export function emptyStateDescriptionClasses(variant: EmptyStateVariant): string {
  return variant === 'inline'
    ? 'mt-1 text-[12px] text-fg-secondary max-w-md'
    : 'mt-1 text-[13px] text-fg-secondary max-w-md';
}

export function emptyStateActionsRowClasses(variant: EmptyStateVariant): string {
  return variant === 'inline'
    ? 'mt-3 flex items-center justify-center gap-3 flex-wrap'
    : 'mt-5 flex items-center justify-center gap-3 flex-wrap';
}

export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
}) => (
  <div role="status" className={cn(emptyStateContainerClasses(variant), className)}>
    {icon && <div className={emptyStateIconWrapClasses(variant)}>{icon}</div>}
    <h3 className={emptyStateTitleClasses(variant)}>{title}</h3>
    {description && <p className={emptyStateDescriptionClasses(variant)}>{description}</p>}
    {(action || secondaryAction) && (
      <div className={emptyStateActionsRowClasses(variant)}>
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
);
