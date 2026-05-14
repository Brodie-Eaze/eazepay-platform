'use client';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingAddon?: ReactNode;
  inputClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailingAddon,
  className,
  inputClassName,
  ...rest
}: InputProps) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-[13px]', className)}>
      {label && (
        <span className="font-medium text-fg-secondary">
          {label}
          {rest.required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-bg-elevated px-3 transition-colors',
          'focus-within:ring-2 focus-within:ring-border-focus focus-within:ring-offset-1 focus-within:ring-offset-bg',
          error ? 'border-danger' : 'border-border hover:border-border-strong',
        )}
      >
        {leadingIcon && <span className="text-fg-muted">{leadingIcon}</span>}
        <input
          {...rest}
          className={cn(
            'h-10 w-full bg-transparent outline-none placeholder:text-fg-muted text-[14px]',
            inputClassName,
          )}
        />
        {trailingAddon && <span className="text-fg-muted text-[13px]">{trailingAddon}</span>}
      </div>
      {error ? (
        <span className="text-danger text-[12px]">{error}</span>
      ) : hint ? (
        <span className="text-fg-muted text-[12px]">{hint}</span>
      ) : null}
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className, ...rest }: TextareaProps) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-[13px]', className)}>
      {label && <span className="font-medium text-fg-secondary">{label}</span>}
      <textarea
        {...rest}
        className={cn(
          'min-h-[96px] rounded-md border bg-bg-elevated px-3 py-2 text-[14px]',
          'outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 focus:ring-offset-bg',
          error ? 'border-danger' : 'border-border',
        )}
      />
      {error ? (
        <span className="text-danger text-[12px]">{error}</span>
      ) : hint ? (
        <span className="text-fg-muted text-[12px]">{hint}</span>
      ) : null}
    </label>
  );
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, hint, options, className, ...rest }: SelectProps) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-[13px]', className)}>
      {label && <span className="font-medium text-fg-secondary">{label}</span>}
      <select
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        className={cn(
          'h-10 rounded-md border border-border bg-bg-elevated px-3 text-[14px]',
          'outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 focus:ring-offset-bg',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-fg-muted text-[12px]">{hint}</span>}
    </label>
  );
}
