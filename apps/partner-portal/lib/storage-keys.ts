/**
 * Centralized localStorage key constants.
 *
 * Storage-event listeners compare against these constants so the
 * writer and the reader never drift. Importing from one place also
 * means Gitleaks only sees the key string once (here) instead of
 * once-per-consumer, which it flagged as `generic-api-key`
 * false-positives in earlier iterations.
 *
 * These are NOT secrets — they are static identifiers for localStorage
 * partitions. Tagged with `gitleaks:allow` so the scanner skips them.
 */
// gitleaks:allow
export const STORAGE_KEYS = {
  notifications: 'eazepay_notifications_v3',
  recentItems: 'eazepay_recent_items_v1',
  savedViews: 'eazepay_saved_views_v1',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
