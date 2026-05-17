'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
  type Notification,
} from '../lib/notifications';

/**
 * NotificationBell — top-right surface that surfaces recent
 * activity for whoever is signed in.
 *
 * Scopes:
 *   - master operator → recipient='master', sees fleet-wide events
 *     (mirror of every send composer click, every confirm/dispute)
 *   - partner merchant → recipient=<merchantId>, sees only their
 *     own notifications (invoices received from EazePay, etc.)
 *
 * Reading the store:
 *   - On mount + every 5s, re-reads the localStorage store and
 *     refreshes the unread counter + dropdown contents.
 *   - Also listens to the cross-tab 'storage' event so a notification
 *     written in one tab pops in another tab without a page reload.
 *   - When the SSE event bus is live (EVENTS_ENABLED=true), this
 *     swaps to subscribe to a per-recipient notification channel —
 *     the surface stays the same.
 *
 * Hardening:
 *   - The recipient prop is determined by the parent (Shell) based
 *     on activeBrand. The store is per-browser/localStorage, so PII
 *     never crosses tenants on the network — but partners on a
 *     shared device must sign out first. Standard browser hygiene.
 *   - Click-outside + Escape close the dropdown.
 */
export function NotificationBell({ recipient }: { recipient: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pull from store on mount, every 5s, and on cross-tab storage events.
  useEffect(() => {
    const refresh = () => {
      setItems(listNotifications(recipient, 50));
      setUnread(unreadCount(recipient));
    };
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

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
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
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-bg-elevated"
            aria-hidden
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[360px] rounded-xl border border-border bg-bg-elevated shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
              Notifications
            </span>
            <button
              type="button"
              onClick={() => {
                markAllRead(recipient);
                setItems(listNotifications(recipient, 50));
                setUnread(0);
              }}
              disabled={unread === 0}
              className="text-[11px] text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Mark all read
            </button>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12px] text-fg-muted">
              No notifications yet.
            </div>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    item={n}
                    onClick={() => {
                      markRead(recipient, n.id);
                      setItems(listNotifications(recipient, 50));
                      setUnread(unreadCount(recipient));
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onClick }: { item: Notification; onClick: () => void }) {
  const content = (
    <div
      className={
        'flex items-start gap-3 px-4 py-3 hover:bg-bg-muted/40 transition cursor-pointer ' +
        (item.readAt ? '' : 'bg-info-bg/30')
      }
      onClick={onClick}
    >
      <span
        className={
          'mt-1 size-1.5 rounded-full shrink-0 ' +
          (item.readAt ? 'bg-transparent border border-border' : 'bg-rose-500')
        }
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-fg truncate">{item.title}</p>
        <p className="mt-0.5 text-[12px] text-fg-secondary leading-snug">{item.body}</p>
        <p className="mt-1 text-[10px] text-fg-muted">{formatRelative(item.createdAt)}</p>
      </div>
    </div>
  );
  if (item.href) return <Link href={item.href}>{content}</Link>;
  return content;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
