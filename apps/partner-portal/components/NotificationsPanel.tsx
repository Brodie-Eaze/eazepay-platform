'use client';
/**
 * NotificationsPanel — Sprint G upgrade to the topbar bell. Replaces
 * the small dropdown in `<NotificationBell>` with a wide (380px),
 * right-sliding panel categorised into three sections:
 *
 *   - Applications  (submissions / approvals / fundings / declines)
 *   - Partners      (onboarding / suspensions / MID issuance)
 *   - Alerts        (webhook failures / SLO breach / DLQ / CVEs)
 *
 * The bell itself stays — we keep its store contract
 * (`lib/notifications.ts`) and unread-count badge, but the open
 * surface is this panel. Categorisation derives from
 * `Notification.kind` so we don't have to change the store schema.
 *
 * Realtime wiring: the existing 5s poll + `storage` event from
 * `lib/notifications.ts` keeps us live without a backend. When
 * the Pusher brand-channel pulse from Sprint H is wired into a
 * `bind('notification', …)` callback, push the payload through
 * `pushNotification()` and the panel updates without a refactor —
 * the panel reads from the same store the bell does today.
 *
 * Synthetic demo data: if the store is empty for the current
 * recipient and `NEXT_PUBLIC_DEMO_NOTIFICATIONS !== 'off'`, we
 * seed a small fixture so demos always have content.
 *
 * Animation: plain CSS transition (translateX) — respects
 * `prefers-reduced-motion` via the `motion-safe:` Tailwind variant.
 * Sprint A's `<MotionSlide>` can drop in later by replacing the
 * inner wrapper.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatTime } from '@eazepay/shared-utils/format-time';
import { EmptyState } from '@eazepay/ui/web';
import {
  listNotifications,
  markAllRead,
  markRead,
  pushNotification,
  unreadCount,
  type Notification,
  type NotificationKind,
} from '../lib/notifications';
import { STORAGE_KEYS } from '../lib/storage-keys';

/**
 * Section assignment is FIRST-MATCH-WINS to keep each notification in
 * exactly one section. Order is intentional:
 *
 *   applications → partners → alerts
 *
 * "Partner onboarding completed" carries `kind: 'system'` AND has
 * "partner" + "onboard" in its title, so the partners rule MUST come
 * before alerts or the row appears in both sections (visible bug shipped
 * in Sprint G's first cut).
 */
const SECTIONS: Array<{
  id: 'applications' | 'partners' | 'alerts';
  title: string;
  match: (n: Notification) => boolean;
}> = [
  {
    id: 'applications',
    title: 'Applications',
    match: (n) =>
      n.kind === 'application_submitted' ||
      n.kind === 'application_funded' ||
      n.kind === 'invoice_sent' ||
      n.kind === 'invoice_paid' ||
      n.kind === 'invoice_confirmed' ||
      n.kind === 'invoice_disputed',
  },
  {
    id: 'partners',
    title: 'Partners',
    match: (n) => {
      const t = n.title.toLowerCase();
      return t.includes('partner') || t.includes('onboard') || t.includes('mid issued');
    },
  },
  {
    id: 'alerts',
    title: 'Alerts',
    match: (n) => {
      const t = n.title.toLowerCase();
      return (
        n.kind === 'system' ||
        t.includes('webhook') ||
        t.includes('slo') ||
        t.includes('dlq') ||
        t.includes('cve')
      );
    },
  },
];

/** First-match-wins section assignment. */
function assignSection(n: Notification): (typeof SECTIONS)[number]['id'] | null {
  for (const s of SECTIONS) {
    if (s.match(n)) return s.id;
  }
  return null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface NotificationsPanelProps {
  recipient: string;
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ recipient, open, onClose }: NotificationsPanelProps) {
  const [items, setItems] = useState<Notification[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Refresh from the store. Mirror of NotificationBell — same 5s
  // poll + cross-tab `storage` listener so the panel and badge agree.
  useEffect(() => {
    const refresh = () => {
      setItems(listNotifications(recipient, 200));
    };
    refresh();
    const interval = window.setInterval(refresh, 5000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.notifications || e.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [recipient]);

  // Seed synthetic demo notifications when the store is empty.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_DEMO_NOTIFICATIONS === 'off') return;
    const existing = listNotifications(recipient, 1);
    if (existing.length > 0) return;
    seedDemoNotifications(recipient);
    setItems(listNotifications(recipient, 200));
  }, [recipient]);

  // Close on Escape only. Backdrop click-to-close is wired directly
  // on the backdrop element below — much more reliable than a window
  // mousedown listener which kept getting re-registered when onClose
  // identity changed each render, and could fire mid-toggle on the
  // bell button causing the panel to stay open / not close cleanly.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grouped = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = items.filter((n) => new Date(n.createdAt).getTime() >= cutoff);
    // Exclusive assignment: each notification lives in exactly one
    // section (the first that matches per SECTIONS order). Was
    // double-counting before — partner onboarding showed in both
    // PARTNERS and ALERTS because its kind is 'system' AND its title
    // contains "partner". Real cost: total count was inflated, and
    // users saw the same row twice.
    const buckets: Record<'applications' | 'partners' | 'alerts', Notification[]> = {
      applications: [],
      partners: [],
      alerts: [],
    };
    for (const n of recent) {
      const sectionId = assignSection(n);
      if (sectionId) buckets[sectionId].push(n);
    }
    return SECTIONS.map((s) => ({ ...s, items: buckets[s.id] }));
  }, [items]);

  const total = grouped.reduce((a, b) => a + b.items.length, 0);

  return (
    <>
      {/* Backdrop — click anywhere outside the panel closes it.
          aria-hidden so screen readers don't announce it; the panel
          itself owns the dialog semantics. */}
      {open && (
        <button
          type="button"
          aria-label="Close notifications"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 motion-safe:animate-in motion-safe:fade-in cursor-default"
        />
      )}
      <aside
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
        className={
          'fixed top-0 right-0 z-50 h-dvh w-[380px] max-w-[92vw] bg-bg-elevated border-l border-border shadow-2xl flex flex-col ' +
          'transition-transform duration-200 motion-reduce:transition-none ' +
          (open ? 'translate-x-0' : 'translate-x-full pointer-events-none')
        }
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-semibold">Notifications</h2>
            <span className="text-[11px] text-fg-muted">
              {total === 0 ? 'No recent activity' : `${total} in last 7 days`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="size-7 rounded-md text-fg-muted hover:text-fg hover:bg-bg-muted flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {total === 0 ? (
            <div className="p-6">
              <EmptyState
                title="You're all caught up"
                description="New applications, partner events, and platform alerts will appear here as they happen."
              />
            </div>
          ) : (
            grouped.map((section) => (
              <NotificationSection
                key={section.id}
                title={section.title}
                items={section.items}
                collapsed={collapsed[section.id] === true}
                onToggle={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
                onMarkRead={(id) => {
                  markRead(recipient, id);
                  setItems(listNotifications(recipient, 200));
                }}
                onClose={onClose}
              />
            ))
          )}
        </div>

        <div className="px-4 h-12 border-t border-border flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              markAllRead(recipient);
              setItems(listNotifications(recipient, 200));
            }}
            disabled={unreadCount(recipient) === 0}
            className="text-[12px] text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mark all as read
          </button>
          <Link
            href="/settings/notifications"
            onClick={onClose}
            className="text-[12px] text-fg-muted hover:text-fg"
          >
            Notification settings
          </Link>
        </div>
      </aside>
    </>
  );
}

function NotificationSection({
  title,
  items,
  collapsed,
  onToggle,
  onMarkRead,
  onClose,
}: {
  title: string;
  items: Notification[];
  collapsed: boolean;
  onToggle: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-bg-muted/40"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-fg-muted">{items.length}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {!collapsed && items.length === 0 && (
        <p className="px-4 pb-3 text-[12px] text-fg-muted">Nothing to show.</p>
      )}
      {!collapsed && items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationRow
                item={item}
                onClick={() => {
                  onMarkRead(item.id);
                  // Close panel on click so the navigation that the
                  // wrapping <Link> dispatches lands on a clean canvas
                  // (previously the panel stayed open over the new
                  // page, making clicks feel like dead ends).
                  onClose();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ item, onClick }: { item: Notification; onClick: () => void }) {
  const body = (
    <div
      className={
        'flex items-start gap-3 px-4 py-3 transition cursor-pointer hover:bg-bg-muted/40 ' +
        (item.readAt ? '' : 'bg-info-bg/30')
      }
      onClick={onClick}
    >
      <span
        aria-hidden
        className={
          'mt-1.5 size-1.5 rounded-full shrink-0 ' +
          (item.readAt ? 'border border-border' : 'bg-rose-500')
        }
      />
      <KindIcon kind={item.kind} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-fg truncate">{item.title}</p>
        <p className="mt-0.5 text-[12px] text-fg-secondary leading-snug line-clamp-2">
          {item.body}
        </p>
        <p className="mt-1 text-[10px] text-fg-muted">
          {formatTime(item.createdAt, { mode: 'relative' })}
        </p>
      </div>
    </div>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

function KindIcon({ kind }: { kind: NotificationKind }) {
  // Mono palette — colour comes only from the unread dot.
  return (
    <span className="size-5 rounded-md bg-bg-muted text-fg-muted flex items-center justify-center shrink-0 mt-0.5">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {kind === 'application_funded' || kind === 'invoice_paid' ? (
          <path d="M20 6 9 17l-5-5" />
        ) : kind === 'invoice_disputed' || kind === 'system' ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </>
        ) : (
          <>
            <path d="M4 4h16v16H4z" />
            <path d="M4 9h16" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * Seed a small fixture so the panel always has content for demos.
 * Idempotent — the caller only invokes when the store is empty.
 *
 * Each sample passes an explicit `createdAt` so the panel shows a
 * realistic spread of timestamps (8m, 42m, 1.5h, 3.5h, 11h ago) rather
 * than 5 identical "1 min. ago" entries — fixes the "obviously fake"
 * demo feel that shipped in Sprint G's first cut.
 */
function seedDemoNotifications(recipient: string): void {
  const now = Date.now();
  const at = (m: number) => new Date(now - m * 60_000).toISOString();
  const samples: Array<Omit<Parameters<typeof pushNotification>[0], 'recipient'>> = [
    {
      kind: 'application_submitted',
      title: 'New application submitted',
      body: 'TradePay · ACME Roofing · $45,000 requested',
      // Deep-link to the application detail so the click takes the
      // operator straight to the row they care about, not the generic
      // index page (which felt like a dead end).
      href: '/applications?focus=tradepay-acme-45k',
      createdAt: at(8),
    },
    {
      kind: 'application_funded',
      title: 'Application funded',
      body: 'MedPay · Lakeside Dental · $12,800 funded by Helios Capital',
      href: '/applications?focus=medpay-lakeside-12k8',
      createdAt: at(42),
    },
    {
      kind: 'system',
      title: 'Webhook failure rate above SLO',
      body: 'partner-events: 4.1% failures over the last 15m (SLO 1%).',
      href: '/admin/observability?panel=webhook-slo',
      createdAt: at(95),
    },
    {
      kind: 'system',
      title: 'Partner onboarding completed',
      body: 'Northstar Auto Group finished KYC + MID issued (MID 7741).',
      // Open the partner's control surface directly; MID 7741 = p_atlas
      // in the seed roster (see lib/master-data).
      href: '/control-panel/p_atlas',
      createdAt: at(220),
    },
    {
      kind: 'invoice_paid',
      title: 'Invoice paid',
      body: 'CoachPay · Peak Performance Coaching · $1,950',
      href: '/invoices?focus=coachpay-peak-1950',
      createdAt: at(680),
    },
  ];
  for (const s of samples) {
    pushNotification({ recipient, ...s });
  }
}
