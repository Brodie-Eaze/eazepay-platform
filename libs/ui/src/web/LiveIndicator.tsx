'use client';
import { useEffect, useRef, useState, type FC } from 'react';
import { cn } from './cn';

/**
 * LiveIndicator — small "Live" pill that flashes when an update lands.
 *
 * WHY:
 *   Operators want to know at a glance that the dashboard is wired to a
 *   live stream vs. a static snapshot. The pulse is intentionally subtle
 *   (one short flash per event) so an active console isn't seizure
 *   territory.
 *
 *   We trigger the flash by watching `pulseKey`: every time it changes we
 *   restart the animation. The parent typically increments a counter on
 *   each Pusher event.
 */
export const LiveIndicator: FC<{
  /** Increment this any time you want the indicator to flash. */
  pulseKey?: number | string;
  /** Optional label override. Default 'Live'. */
  label?: string;
  className?: string;
}> = ({ pulseKey, label = 'Live', className }) => {
  const [pulsing, setPulsing] = useState(false);
  const last = useRef<number | string | undefined>(pulseKey);
  useEffect(() => {
    if (pulseKey === undefined) return;
    if (last.current === pulseKey) return;
    last.current = pulseKey;
    setPulsing(true);
    const id = setTimeout(() => setPulsing(false), 800);
    return () => clearTimeout(id);
  }, [pulseKey]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={pulsing ? `${label} — update received` : label}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-1.5 rounded-full bg-success',
          pulsing ? 'animate-ping' : 'opacity-80',
        )}
      />
      {label}
    </span>
  );
};
