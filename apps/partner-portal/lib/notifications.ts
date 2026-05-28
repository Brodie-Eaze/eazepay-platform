/**
 * Notifications store — small, in-portal notification surface that
 * the bell icon in the top-right reads from.
 *
 * Posture for v1:
 *   - localStorage-backed so it works without the backend deployed.
 *   - Keyed by `recipient`: a partner merchantId for per-brand
 *     notifications, or the literal string 'master' for operator
 *     notifications (audit feed across the fleet).
 *   - Caps at 200 entries per recipient — oldest dropped first so
 *     the store doesn't grow unbounded. When the BFF lands, the
 *     same read/write surface swaps to `/v1/notifications` calls;
 *     callers (NotificationBell, SendDialog) stay unchanged.
 *
 * NOTE on cross-tab sync:
 *   The bell polls every 5s for new entries because we can't easily
 *   subscribe to localStorage cross-window. Once the SSE event bus
 *   is live (EVENTS_ENABLED=true), the bell will swap to subscribe
 *   to notification events directly.
 */

// v2: bumped from v1 to invalidate the buggy first-cut seed which
// wrote 5 entries with identical "1 min ago" timestamps and a
// duplicate cross-section entry. Browsers that opened the v1 panel
// during the broken window will get a fresh seed with backdated
// timestamps + exclusive section assignment.
const STORE_KEY = 'eazepay_notifications_v3';
const MAX_PER_RECIPIENT = 200;

export type NotificationKind =
  | 'invoice_sent'
  | 'invoice_confirmed'
  | 'invoice_disputed'
  | 'invoice_paid'
  | 'application_funded'
  | 'application_submitted'
  | 'system';

export interface Notification {
  id: string;
  /** merchantId (per-brand) or literal 'master' (operator). */
  recipient: string;
  kind: NotificationKind;
  /** Short label that becomes the row title in the dropdown. */
  title: string;
  /** 1-2 sentences of context. */
  body: string;
  /** Optional deep-link the row clicks through to. */
  href?: string;
  /** ISO timestamp when created. */
  createdAt: string;
  /** ISO timestamp when read, null when unread. */
  readAt?: string | null;
}

function makeId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): Record<string, Notification[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, Notification[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      const list: Notification[] = [];
      for (const raw of v) {
        if (!raw || typeof raw !== 'object') continue;
        const n = raw as Record<string, unknown>;
        if (
          typeof n.id !== 'string' ||
          typeof n.recipient !== 'string' ||
          typeof n.kind !== 'string' ||
          typeof n.title !== 'string' ||
          typeof n.body !== 'string' ||
          typeof n.createdAt !== 'string'
        ) {
          continue;
        }
        list.push({
          id: n.id,
          recipient: n.recipient,
          kind: n.kind as NotificationKind,
          title: n.title,
          body: n.body,
          href: typeof n.href === 'string' ? n.href : undefined,
          createdAt: n.createdAt,
          readAt: typeof n.readAt === 'string' ? n.readAt : null,
        });
      }
      out[k] = list;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Notification[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all));
    // Cross-tab nudge — sibling tabs in the same browser get a
    // 'storage' event and can refresh their bell counter.
    window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY }));
  } catch {
    /* swallow */
  }
}

export interface PushInput {
  recipient: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  /** Override the default `now` timestamp. Used by seed fixtures so
   *  demo notifications don't all show as "1 min ago". */
  createdAt?: string;
}

export function pushNotification(input: PushInput): Notification {
  const all = readAll();
  const entry: Notification = {
    id: makeId(),
    recipient: input.recipient,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: input.createdAt ?? new Date().toISOString(),
    readAt: null,
  };
  const list = all[input.recipient] ?? [];
  list.unshift(entry);
  // Cap at MAX_PER_RECIPIENT — drop oldest.
  if (list.length > MAX_PER_RECIPIENT) list.length = MAX_PER_RECIPIENT;
  all[input.recipient] = list;
  writeAll(all);
  return entry;
}

/**
 * pushNotification + ALSO fan out to 'master' so the operator's bell
 * always sees what was sent to a partner. Used by the SendDialog so
 * the master gets a mirror of every invoice they dispatched.
 */
export function pushNotificationWithMasterMirror(
  input: PushInput & { masterTitle?: string; masterBody?: string },
): void {
  pushNotification(input);
  if (input.recipient !== 'master') {
    pushNotification({
      recipient: 'master',
      kind: input.kind,
      title: input.masterTitle ?? `Sent to ${input.recipient}: ${input.title}`,
      body: input.masterBody ?? input.body,
      href: input.href,
    });
  }
}

export function listNotifications(recipient: string, limit = 50): Notification[] {
  const all = readAll();
  return (all[recipient] ?? []).slice(0, limit);
}

export function unreadCount(recipient: string): number {
  const all = readAll();
  return (all[recipient] ?? []).filter((n) => !n.readAt).length;
}

export function markRead(recipient: string, id: string): void {
  const all = readAll();
  const list = all[recipient] ?? [];
  const next = list.map((n) =>
    n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n,
  );
  all[recipient] = next;
  writeAll(all);
}

export function markAllRead(recipient: string): void {
  const all = readAll();
  const now = new Date().toISOString();
  const list = (all[recipient] ?? []).map((n) => (n.readAt ? n : { ...n, readAt: now }));
  all[recipient] = list;
  writeAll(all);
}

export function clearAll(recipient: string): void {
  const all = readAll();
  delete all[recipient];
  writeAll(all);
}
