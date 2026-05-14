'use client';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from './cn';

/**
 * Masked PII field with explicit unmask button. Default behavior is
 * masked. Unmask requires reason (the caller passes a handler that
 * opens a JIT unmask flow). UI surfaces the friction by design — we
 * never want PII to flash incidentally.
 */
export const MaskedField: FC<{
  label: string;
  masked: string;
  unmasked?: string | null;
  onRequestUnmask?: () => void;
  /** Whether a current unmask grant is active. */
  unmaskActive?: boolean;
  className?: string;
}> = ({ label, masked, unmasked, onRequestUnmask, unmaskActive, className }) => {
  const [show, setShow] = useState(false);
  const value = show && unmasked ? unmasked : masked;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold">
        {label}
      </span>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated/60 px-3 py-2">
        <span className={cn('font-mono text-[13px]', show && unmasked && 'text-fg')}>
          {value}
        </span>
        {unmaskActive && unmasked ? (
          <button
            onClick={() => setShow((v) => !v)}
            className="text-[12px] text-accent hover:underline"
          >
            {show ? 'Hide' : 'Reveal'}
          </button>
        ) : (
          <button
            onClick={onRequestUnmask}
            className="text-[12px] text-accent hover:underline"
          >
            Request unmask
          </button>
        )}
      </div>
    </div>
  );
};

/** Read-only key/value row inside a panel. */
export const DataRow: FC<{ label: ReactNode; value: ReactNode; className?: string }> = ({
  label,
  value,
  className,
}) => (
  <div className={cn('flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0', className)}>
    <span className="text-[12px] text-fg-muted uppercase tracking-wider font-medium">{label}</span>
    <span className="text-[13px] font-medium tabular-nums">{value}</span>
  </div>
);
