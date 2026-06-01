import type { ReactNode } from 'react';

/** Tiny classnames joiner (keeps us off a lib import for one helper). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* Shared CTA button styles (anchors — this is a marketing surface). */
export const ctaPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-sky px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-sky-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky';

export const ctaGhostDark =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10';

export const ctaGhostLight =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-3 text-sm font-semibold text-fg transition-colors hover:bg-bg-muted';

/** Section outer wrapper — consistent max width + horizontal padding. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('mx-auto w-full max-w-[1180px] px-5 sm:px-8', className)}>{children}</div>
  );
}

/** Uppercase mono eyebrow label with a leading tick. */
export function Eyebrow({
  children,
  tone = 'sky',
}: {
  children: ReactNode;
  tone?: 'sky' | 'muted';
}) {
  return (
    <span
      className={cx(
        'ez-eyebrow inline-flex items-center gap-2',
        tone === 'sky' ? 'text-brand-sky' : 'text-fg-muted',
      )}
    >
      <span className="ez-live-dot" aria-hidden />
      {children}
    </span>
  );
}

/** Small rounded chip used for tags / metrics. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
