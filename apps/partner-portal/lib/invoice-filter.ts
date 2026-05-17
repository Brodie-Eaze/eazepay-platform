/**
 * Invoice search, sort, and date-range filter — pure functions.
 * Decoupled from React so the same logic powers the in-memory view
 * AND the CSV export (so an exported file matches what's on screen).
 */
import type { InvoiceStatus } from './invoicing';

export interface FilterableInvoice {
  invoiceNo: string;
  merchant: string;
  email: string;
  vertical: string;
  grossFundedCents: number;
  feePct: number;
  feeAmountCents: number;
  status: InvoiceStatus;
  dueDate: string; // YYYY-MM-DD
  periodLabel: string;
  voided?: boolean;
}

export type SortKey =
  | 'merchant'
  | 'vertical'
  | 'gross'
  | 'feePct'
  | 'feeAmount'
  | 'status'
  | 'dueDate';

export type SortDir = 'asc' | 'desc';

export type DateRange = 'all' | 'thisMonth' | 'lastMonth' | 'last3Months';

export interface InvoiceFilter {
  search: string;
  status: 'all' | InvoiceStatus;
  dateRange: DateRange;
  sort: SortKey;
  dir: SortDir;
  hideVoided: boolean;
}

export const DEFAULT_FILTER: InvoiceFilter = {
  search: '',
  status: 'all',
  dateRange: 'all',
  sort: 'feeAmount',
  dir: 'desc',
  // Voided rows stay visible by default — they render greyed with a
  // VOID badge so accounts can still find them (e.g. to unvoid).
  hideVoided: false,
};

function matchesSearch(r: FilterableInvoice, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    r.merchant.toLowerCase().includes(needle) ||
    r.email.toLowerCase().includes(needle) ||
    r.invoiceNo.toLowerCase().includes(needle)
  );
}

function matchesDateRange(r: FilterableInvoice, range: DateRange, today = new Date()): boolean {
  if (range === 'all') return true;
  const due = new Date(r.dueDate + 'T00:00:00');
  const y = today.getFullYear();
  const m = today.getMonth();
  if (range === 'thisMonth') {
    return due.getFullYear() === y && due.getMonth() === m;
  }
  if (range === 'lastMonth') {
    const lm = new Date(y, m - 1, 1);
    return due.getFullYear() === lm.getFullYear() && due.getMonth() === lm.getMonth();
  }
  if (range === 'last3Months') {
    const cutoff = new Date(y, m - 2, 1);
    return due >= cutoff;
  }
  return true;
}

function compareBy(a: FilterableInvoice, b: FilterableInvoice, key: SortKey): number {
  switch (key) {
    case 'merchant':
      return a.merchant.localeCompare(b.merchant);
    case 'vertical':
      return a.vertical.localeCompare(b.vertical);
    case 'gross':
      return a.grossFundedCents - b.grossFundedCents;
    case 'feePct':
      return a.feePct - b.feePct;
    case 'feeAmount':
      return a.feeAmountCents - b.feeAmountCents;
    case 'status':
      return a.status.localeCompare(b.status);
    case 'dueDate':
      return a.dueDate.localeCompare(b.dueDate);
  }
}

export function applyInvoiceFilter<T extends FilterableInvoice>(
  rows: T[],
  filter: InvoiceFilter,
): T[] {
  const out = rows.filter((r) => {
    if (filter.hideVoided && r.voided) return false;
    if (filter.status !== 'all' && r.status !== filter.status) return false;
    if (!matchesSearch(r, filter.search)) return false;
    if (!matchesDateRange(r, filter.dateRange)) return false;
    return true;
  });
  out.sort((a, b) => {
    const c = compareBy(a, b, filter.sort);
    return filter.dir === 'asc' ? c : -c;
  });
  return out;
}

/**
 * Overdue is a function of (status, dueDate, today) — recompute it at
 * render time rather than persisting it, so it stays honest even if
 * the accounts team doesn't open the page for a few days.
 */
export function isOverdueByDate(dueDate: string, today = new Date()): boolean {
  const d = new Date(dueDate + 'T23:59:59');
  return today > d;
}
