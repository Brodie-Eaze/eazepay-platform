'use client';
import type { ReactNode } from 'react';

/**
 * Shared form-field primitives for the Welcome wizard. Single source
 * of label / input / error styling so every step looks consistent.
 *
 * Mono palette — error states use the strong navy border + darker
 * foreground text. No red anywhere inside the portal.
 */

export function Field({
  label,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-fg mb-1.5">
        {label}
        {required && <span className="text-fg-secondary ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-fg-muted">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-fg font-semibold">{error}</p>}
    </div>
  );
}

export function TextInput({
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={
        'w-full h-11 rounded-lg border bg-bg-elevated px-3.5 text-[14px] text-fg ' +
        'placeholder:text-fg-muted/70 outline-none transition-all ' +
        (invalid
          ? 'border-fg focus:border-fg focus:ring-2 focus:ring-fg/20'
          : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
      }
    />
  );
}

export function SelectInput({
  invalid,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      className={
        'w-full h-11 rounded-lg border bg-bg-elevated px-3.5 text-[14px] text-fg outline-none transition-all ' +
        (invalid
          ? 'border-fg focus:border-fg focus:ring-2 focus:ring-fg/20'
          : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
      }
    >
      {children}
    </select>
  );
}

export function TextareaInput({
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      className={
        'w-full rounded-lg border bg-bg-elevated px-3.5 py-2.5 text-[14px] text-fg ' +
        'placeholder:text-fg-muted/70 outline-none transition-all resize-y ' +
        (invalid
          ? 'border-fg focus:border-fg focus:ring-2 focus:ring-fg/20'
          : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
      }
    />
  );
}
