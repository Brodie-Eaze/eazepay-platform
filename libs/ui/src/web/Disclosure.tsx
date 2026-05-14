'use client';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { ChevronDownIcon } from './Icon';

/**
 * Compliance / disclosure panel — TILA Reg Z box, FCRA permissible-
 * purpose explainer, ECOA Adverse Action breakdown, etc.
 *
 * Marked-up so screen readers announce the disclosure as a region,
 * and the "I have read" checkbox emits a controlled event that the
 * caller wires to a consent audit write.
 */
export const DisclosurePanel: FC<{
  title: ReactNode;
  /** Plain-English summary, always visible. */
  summary: ReactNode;
  /** Full text, behind a chevron. */
  detail: ReactNode;
  /** Show a "I have read & understand" checkbox; emit on toggle. */
  acceptable?: boolean;
  accepted?: boolean;
  onAcceptChange?: (next: boolean) => void;
  className?: string;
  /** Force-open default state */
  defaultOpen?: boolean;
}> = ({
  title,
  summary,
  detail,
  acceptable,
  accepted,
  onAcceptChange,
  className,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      aria-label={typeof title === 'string' ? title : 'Disclosure'}
      className={cn('rounded-lg border border-border bg-bg-elevated', className)}
    >
      <header className="p-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-md bg-accent-soft text-accent shrink-0 flex items-center justify-center text-[13px] font-semibold">
            i
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold">{title}</h4>
            <p className="mt-1 text-[13px] text-fg-secondary leading-relaxed">{summary}</p>
          </div>
        </div>
      </header>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 text-[12px] font-medium text-fg-muted hover:text-fg flex items-center justify-between border-t border-border"
      >
        <span>{open ? 'Hide full disclosure' : 'Read full disclosure'}</span>
        <ChevronDownIcon size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-[12px] text-fg-secondary leading-relaxed border-t border-border pt-3 max-h-72 overflow-auto">
          {detail}
        </div>
      )}
      {acceptable && (
        <label className="flex items-start gap-3 p-4 border-t border-border bg-bg-muted/40 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted ?? false}
            onChange={(e) => onAcceptChange?.(e.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span className="text-[13px] leading-snug">
            I have read and agree to the terms above. I understand this consent will be recorded with a
            timestamped audit event.
          </span>
        </label>
      )}
    </section>
  );
};
