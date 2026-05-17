import type { NotificationChannel } from '@prisma/client';

/**
 * Notification template registry. Lives in code, NOT the DB — this
 * keeps the templates versioned with the application code so a
 * regulator's "show me the message you sent on date X" can be answered
 * with `git log` + the stored payload.
 *
 * Each template declares which channels it supports. The notify()
 * call falls back to in_app if a higher-priority channel isn't
 * configured for the user.
 */
export interface NotificationTemplate {
  key: string;
  /** Channels we can deliver this template through, in priority order. */
  channels: NotificationChannel[];
  /** Subject (email) or short title (push/in-app). */
  title: (vars: Record<string, unknown>) => string;
  /** Plain-text body. Email/SMS/push share this; HTML rendering happens
   *  in the channel adapter for email. Keep < 1600 chars (SMS friendly). */
  body: (vars: Record<string, unknown>) => string;
}

const fmt = (vars: Record<string, unknown>, key: string, fallback = ''): string => {
  const v = vars[key];
  return v === undefined || v === null ? fallback : String(v);
};

const fmtMoney = (cents: unknown): string => {
  if (typeof cents !== 'string' && typeof cents !== 'number' && typeof cents !== 'bigint')
    return '$0.00';
  const n = typeof cents === 'bigint' ? Number(cents) : Number(cents);
  return `$${(n / 100).toFixed(2)}`;
};

export const TEMPLATES: Record<string, NotificationTemplate> = {
  'application.offers_presented': {
    key: 'application.offers_presented',
    channels: ['push', 'email', 'in_app'],
    title: () => 'Your finance offers are ready',
    body: (v) =>
      `We've matched ${fmt(v, 'offerCount', 'a few')} offers for your application. ` +
      `Open EazePay to compare and accept the one you want.`,
  },
  'application.declined': {
    key: 'application.declined',
    channels: ['email', 'in_app'],
    title: () => 'Decision on your EazePay application',
    body: () =>
      `We were unable to approve your application at this time. We've sent a separate ` +
      `Adverse Action Notice with the specific reasons and information about your rights ` +
      `under the Fair Credit Reporting Act and the Equal Credit Opportunity Act.`,
  },
  'application.contracted': {
    key: 'application.contracted',
    channels: ['push', 'email', 'in_app'],
    title: () => 'Your loan agreement is signed',
    body: (v) =>
      `Your loan with ${fmt(v, 'lenderOfRecord', 'your lender')} is signed. ` +
      `Funds are on the way; we'll notify you again when they settle.`,
  },
  'application.funded': {
    key: 'application.funded',
    channels: ['push', 'email', 'in_app'],
    title: () => 'Your funds have been disbursed',
    body: (v) =>
      `${fmtMoney(v['principalCents'])} has been disbursed. ` +
      `Your first payment is due ${fmt(v, 'firstPaymentDate', 'soon')}.`,
  },
  'application.funding_failed': {
    key: 'application.funding_failed',
    channels: ['push', 'email', 'in_app'],
    title: () => 'We couldn`t complete your funding',
    body: (v) =>
      `Your loan funding didn't go through (reason: ${fmt(v, 'reasonCode', 'unknown')}). ` +
      `We'll retry automatically; no action needed yet.`,
  },
  'payment.repayment.collected': {
    key: 'payment.repayment.collected',
    channels: ['push', 'email', 'in_app'],
    title: () => 'Payment received',
    body: (v) =>
      `Thanks — we received your payment of ${fmtMoney(v['amountCents'])}. ` +
      `${fmt(v, 'remainingPayments', '')} payments remaining.`,
  },
  'payment.repayment.failed': {
    key: 'payment.repayment.failed',
    channels: ['push', 'email', 'sms', 'in_app'],
    title: () => 'Payment didn`t go through',
    body: (v) =>
      `We tried to collect ${fmtMoney(v['amountCents'])} but it didn't go through ` +
      `(${fmt(v, 'reasonCode', 'unknown')}). We'll retry; please confirm your bank ` +
      `account has sufficient funds. Reply to this message for help.`,
  },
};

export const getTemplate = (key: string): NotificationTemplate | undefined => TEMPLATES[key];
