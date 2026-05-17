'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Bank-grade idle timeout for the partner-portal /apply/<brand>
 * consumer landing. Mirror of apps/consumer-web/components/IdleGuard.
 *
 * WHY THIS EXISTS
 * ---------------
 * Consumers fill out the apply form on shared family laptops, employer
 * workstations, kiosks. If they walk away, the next person at the
 * keyboard could read their pre-filled name/email/phone or pick up
 * mid-flow. Bank-grade UX is: warn at 10 minutes idle, kill at +60
 * seconds with state wiped, redirect to a restart screen.
 *
 * Activity is keydown / mousemove / scroll / touchstart. Focus events
 * are deliberately excluded because tab refocus without input doesn't
 * mean the consumer is back at the keyboard.
 */
const IDLE_WARN_MS = 10 * 60 * 1000;
const IDLE_KILL_MS = 60 * 1000;

interface Props {
  onExpire: () => void;
}

export function ConsumerIdleGuard({ onExpire }: Props) {
  const [warned, setWarned] = useState(false);
  const [countdown, setCountdown] = useState(IDLE_KILL_MS / 1000);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const killTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (killTimer.current) clearTimeout(killTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setWarned(false);
    setCountdown(IDLE_KILL_MS / 1000);
    warnTimer.current = setTimeout(() => {
      setWarned(true);
      setCountdown(IDLE_KILL_MS / 1000);
      countdownTimer.current = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
      killTimer.current = setTimeout(() => {
        onExpire();
      }, IDLE_KILL_MS);
    }, IDLE_WARN_MS);
  };

  useEffect(() => {
    reset();
    const events: Array<keyof DocumentEventMap> = ['keydown', 'mousemove', 'scroll', 'touchstart'];
    for (const e of events) document.addEventListener(e, reset, { passive: true });
    return () => {
      for (const e of events) document.removeEventListener(e, reset);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (killTimer.current) clearTimeout(killTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!warned) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="consumer-idle-title"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 id="consumer-idle-title" className="text-[20px] font-bold text-gray-900">
          Are you still there?
        </h2>
        <p className="mt-2 text-[14px] text-gray-700 leading-relaxed">
          For your security, this session will expire in{' '}
          <strong className="tabular-nums">{countdown}</strong> seconds. Your form information will
          be cleared.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-10 px-5 rounded-lg bg-gray-900 text-white text-[14px] font-semibold"
          >
            Keep me here
          </button>
        </div>
      </div>
    </div>
  );
}
