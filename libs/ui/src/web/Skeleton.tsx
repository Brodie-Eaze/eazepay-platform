import type { FC } from 'react';
import { cn } from './cn';

/**
 * Loading skeleton. Marked `aria-busy="true"` + `aria-live="polite"`
 * so screen-readers ignore the shimmer placeholders themselves but
 * announce when the real content lands. `role="status"` lets a screen
 * reader user know that the surface is loading rather than empty.
 *
 *   <Skeleton rows={4} label="Loading partner roster" />
 *
 * If a parent already provides loading semantics (eg. a Card with its
 * own aria-busy), pass `bare` to skip the role/aria wiring on this
 * instance.
 */
export const Skeleton: FC<{
  className?: string;
  rows?: number;
  label?: string;
  bare?: boolean;
}> = ({ className, rows = 1, label = 'Loading', bare }) => {
  const aria = bare
    ? {}
    : ({
        role: 'status',
        'aria-busy': true,
        'aria-live': 'polite',
        'aria-label': label,
      } as const);
  if (rows === 1) {
    return <div {...aria} className={cn('shimmer rounded h-4 w-full', className)} />;
  }
  return (
    <div {...aria} className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer rounded h-4"
          style={{ width: `${100 - i * 8}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
};
