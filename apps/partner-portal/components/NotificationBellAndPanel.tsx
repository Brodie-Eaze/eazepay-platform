'use client';
/**
 * NotificationBellAndPanel — combines the existing bell icon + unread
 * badge with Sprint G's wider `<NotificationsPanel>`. Drop-in
 * replacement for `<NotificationBell recipient=… />` in the AppShell
 * topRight slot.
 *
 * The bell stays visually identical to v1 (same icon, same red unread
 * dot in the top-right corner) so muscle memory carries over; click
 * opens the new right-edge panel instead of the old narrow dropdown.
 */
import { useEffect, useState } from 'react';
import { unreadCount } from '../lib/notifications';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationBellAndPanel({ recipient }: { recipient: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Poll the store every 5s + listen for cross-tab `storage` events.
  // Same pattern as the v1 bell so the badge stays accurate even
  // when the panel is closed.
  useEffect(() => {
    const refresh = () => setUnread(unreadCount(recipient));
    refresh();
    const interval = window.setInterval(refresh, 5000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'eazepay_notifications_v1' || e.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [recipient]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-fg-secondary hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-bg-elevated"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <NotificationsPanel recipient={recipient} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
