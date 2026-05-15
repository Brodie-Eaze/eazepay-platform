'use client';
/**
 * Shared accessibility + state-display primitives for the partner
 * portal. Lives in `apps/partner-portal/components/` so portal-level
 * pages can pull them without touching the shared UI lib (which other
 * apps depend on).
 *
 * Exports:
 *   • Modal           — accessible Radix-backed dialog wrapper. Auto
 *                       focus-trap, `role="dialog"`, `aria-modal`,
 *                       Escape closes, click-outside closes. Drop-in
 *                       replacement for the page-local `ModalShell`
 *                       div constructions we had scattered across the
 *                       portal.
 *   • LoadingButton   — Button variant that shows an inline spinner +
 *                       toggles `aria-busy` while a request is in
 *                       flight. Underlying button stays focusable so a
 *                       screen-reader user keeps their place.
 *   • ErrorBanner     — Standardised red-tinted alert with optional
 *                       title + dismiss. Uses the shared `Banner`
 *                       under the hood so the aria semantics stay
 *                       consistent (`role="alert"`,
 *                       `aria-live="assertive"`).
 *   • LoadingState    — Skeleton placeholder used inside cards while
 *                       data fetches. Wraps the shared `Skeleton` with
 *                       a configurable row count + label.
 *   • EmptyDataState  — Friendly empty-state used after a fetch
 *                       returns zero rows. Carries an optional CTA
 *                       (eg. "Clear filters", "Create the first
 *                       record").
 */
import type { FC, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Banner,
  Skeleton,
  EmptyState,
  Button,
  type ButtonVariant,
  type ButtonSize,
  XIcon,
} from '@eazepay/ui/web';

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export const Modal: FC<{
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  /** Optional footer slot — rendered inside the dialog footer area. */
  footer?: ReactNode;
}> = ({ open, onClose, title, description, size = 'md', children, footer }) => {
  const maxW = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className={`${maxW} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>{children}</div>
        {footer && (
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Render-prop variant for cases where you need a `DialogClose` button
 *  somewhere inside `children` rather than the auto top-right close. */
export const ModalCloseButton: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <DialogClose className={className}>{children}</DialogClose>;

/* ------------------------------------------------------------------ */
/*  LoadingButton                                                      */
/* ------------------------------------------------------------------ */

export const LoadingButton: FC<{
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}> = ({
  loading,
  loadingLabel,
  disabled,
  onClick,
  type = 'button',
  variant,
  size,
  className,
  children,
}) => (
  <Button
    type={type}
    variant={variant}
    size={size}
    onClick={onClick}
    disabled={disabled || loading}
    loading={loading}
    className={className}
    aria-busy={loading}
    aria-live={loading ? 'polite' : undefined}
  >
    {loading && loadingLabel ? loadingLabel : children}
  </Button>
);

/* ------------------------------------------------------------------ */
/*  ErrorBanner                                                        */
/* ------------------------------------------------------------------ */

export const ErrorBanner: FC<{
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}> = ({ title = 'Something went wrong', children, onDismiss, className }) => (
  <Banner intent="danger" title={title} onDismiss={onDismiss} className={className}>
    {children}
  </Banner>
);

/* ------------------------------------------------------------------ */
/*  LoadingState                                                       */
/* ------------------------------------------------------------------ */

export const LoadingState: FC<{
  rows?: number;
  label?: string;
  className?: string;
}> = ({ rows = 4, label = 'Loading', className }) => (
  <div className={className ?? 'px-5 py-6'}>
    <Skeleton rows={rows} label={label} />
  </div>
);

/* ------------------------------------------------------------------ */
/*  EmptyDataState                                                     */
/* ------------------------------------------------------------------ */

export const EmptyDataState: FC<{
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}> = ({ title, description, action, icon, className }) => (
  <EmptyState
    title={title}
    description={description}
    action={action}
    icon={icon}
    className={className}
  />
);

/* Re-export for ergonomic imports inside the four pages we touch. */
export { Banner, XIcon };
