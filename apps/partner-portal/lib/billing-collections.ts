/**
 * Collections lane — classifies sent invoices into a dunning stage
 * based on age (today vs dueDate) so the Collections tab can render
 * the right action for each row.
 */
import type { InvoiceStatus, InvoicePayment } from './invoicing';

export type CollectionsStage =
  | 'current' // sent, not yet due
  | 'reminder_1' // overdue by 1–6 days
  | 'reminder_2' // overdue by 7–14 days
  | 'collections' // overdue by 15–29 days
  | 'escalated' // overdue by 30+ days
  | 'paid' // fully paid
  | 'partial'; // partial payment received

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysOverdue(dueDate: string, today = new Date()): number {
  const due = new Date(dueDate + 'T23:59:59');
  return Math.floor((today.getTime() - due.getTime()) / DAY_MS);
}

export function classifyStage(
  status: InvoiceStatus,
  dueDate: string,
  payments: InvoicePayment[],
  feeAmountCents: number,
  today = new Date(),
): CollectionsStage {
  if (status === 'paid') return 'paid';
  const paid = payments.reduce((s, p) => s + p.amountCents, 0);
  if (paid > 0 && paid < feeAmountCents) return 'partial';
  const od = daysOverdue(dueDate, today);
  if (od < 0) return 'current';
  if (od < 7) return 'reminder_1';
  if (od < 15) return 'reminder_2';
  if (od < 30) return 'collections';
  return 'escalated';
}

export const STAGE_LABEL: Record<CollectionsStage, string> = {
  current: 'Current',
  reminder_1: 'Reminder 1',
  reminder_2: 'Reminder 2',
  collections: 'Collections',
  escalated: 'Escalated',
  paid: 'Paid',
  partial: 'Partial',
};

export const STAGE_TONE: Record<CollectionsStage, { bg: string; text: string; ring: string }> = {
  current: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200/70' },
  reminder_1: { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-300/70' },
  reminder_2: { bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-300/70' },
  collections: { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-300/70' },
  escalated: { bg: 'bg-rose-200', text: 'text-rose-900', ring: 'ring-rose-400/70' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/70' },
  partial: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200/70' },
};

/**
 * Recommended next action label for a stage — surfaced in the
 * Collections tab as the primary button per row.
 */
export const STAGE_NEXT_ACTION: Record<CollectionsStage, string> = {
  current: 'Send invoice',
  reminder_1: 'Send reminder 1',
  reminder_2: 'Send reminder 2',
  collections: 'Send collections notice',
  escalated: 'Mark for escalation',
  paid: 'Closed',
  partial: 'Send statement',
};
