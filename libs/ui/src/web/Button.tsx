'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Mono palette only. Every variant lifts off the page with a real
 * shadow so it reads as a button, not a tint. Hover bumps the shadow
 * deeper + lightens the surface a touch.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg border border-accent-strong/40 shadow-[0_1px_0_0_rgb(255_255_255_/_0.08)_inset,0_4px_10px_-3px_rgb(15_23_42_/_0.35),0_2px_4px_-2px_rgb(15_23_42_/_0.25)] hover:bg-accent-strong hover:shadow-[0_1px_0_0_rgb(255_255_255_/_0.08)_inset,0_6px_14px_-3px_rgb(15_23_42_/_0.45),0_3px_6px_-2px_rgb(15_23_42_/_0.30)] active:translate-y-[1px] active:shadow-[0_1px_0_0_rgb(255_255_255_/_0.08)_inset,0_2px_6px_-2px_rgb(15_23_42_/_0.40)]',
  secondary:
    'bg-bg-elevated text-fg border border-border shadow-[0_1px_2px_rgb(15_23_42_/_0.06)] hover:border-border-strong hover:bg-bg-muted hover:shadow-[0_2px_4px_rgb(15_23_42_/_0.10)] active:translate-y-[1px] active:shadow-[0_1px_2px_rgb(15_23_42_/_0.08)]',
  ghost:
    'bg-transparent text-fg-secondary hover:text-fg hover:bg-bg-muted border border-transparent',
  danger:
    'bg-fg text-white border border-fg shadow-[0_1px_0_0_rgb(255_255_255_/_0.06)_inset,0_4px_10px_-3px_rgb(15_23_42_/_0.45)] hover:bg-accent-strong hover:shadow-[0_6px_14px_-3px_rgb(15_23_42_/_0.55)] active:translate-y-[1px]',
  subtle:
    'bg-bg-muted text-fg border border-border shadow-[0_1px_2px_rgb(15_23_42_/_0.05)] hover:bg-bg-elevated hover:border-border-strong',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[12px] rounded-lg gap-1.5',
  md: 'h-11 px-[18px] text-[13px] rounded-lg gap-2',
  lg: 'h-12 px-5 text-[14px] rounded-lg gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leadingIcon,
  trailingIcon,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        // Keep the button itself flex so the leading/trailing icon
        // props remain laid out beside the label, but also make the
        // children-wrapper flex so any inline icon a caller passes as
        // children (eg. `<SendIcon /> Send SMS`) sits beside the text
        // instead of breaking onto a new line.
        'inline-flex items-center justify-center font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0',
        'whitespace-nowrap select-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        leadingIcon
      )}
      <span className="inline-flex items-center gap-1.5">{children}</span>
      {trailingIcon}
    </button>
  );
}
