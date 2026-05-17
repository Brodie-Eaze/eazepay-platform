/**
 * Invoicing model — fee schedule, per-merchant override store, and
 * invoice math.
 *
 * EazePay invoices merchants a platform fee on funded volume. The
 * default fee % is set by the merchant's vertical:
 *
 *   MedPay   3.5%   medical / dental / vet / fertility / med-spa
 *   TradePay 5.0%   home-improvement / HVAC / roofing / solar
 *   CoachPay 6.0%   coaching / certifications / courses
 *   Multi    4.5%   blended for partners on >1 brand
 *
 * Per-merchant overrides take precedence — the accounts team can set
 * a custom rate per business from the Invoices page. Overrides live
 * in localStorage so the demo persists across page refreshes; in
 * production they'll round-trip through `/api/billing/fee-overrides`.
 *
 * Math:
 *   fee_amount_cents = round(funded_volume_cents * fee_pct)
 *
 * Numbers are kept in cents (BigInt-safe) so a long-tail of fractional
 * cents accumulate exactly the way the FinOps team expects (see
 * ADR-0012 on the money type).
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

/** Fee % keyed by canonical vertical / product label. */
export const VERTICAL_FEE_PCT = {
  medpay: 0.035,
  tradepay: 0.05,
  coachpay: 0.06,
  multi: 0.045,
} as const;

/** Map a partner.product label to a vertical key. Anything unknown
 *  falls back to the multi-brand rate. */
function productToVertical(product: string): keyof typeof VERTICAL_FEE_PCT {
  const p = product.toLowerCase().replace(/\s+/g, '');
  if (p === 'medpay') return 'medpay';
  if (p === 'tradepay') return 'tradepay';
  if (p === 'coachpay') return 'coachpay';
  return 'multi';
}

/* ──────────────────────────────────────────────────────────────────
 *  Per-merchant fee override store
 * ──────────────────────────────────────────────────────────────────
 *  Keyed by partnerId → custom fee % (decimal, e.g. 0.04 = 4%).
 *  Reads/writes localStorage. SSR-safe (returns empty map on server).
 *  The accounts team can override a single merchant's rate without
 *  touching the vertical-level defaults.
 */

const FEE_OVERRIDE_STORAGE_KEY = 'eazepay_fee_overrides_v1';

export function readFeeOverrides(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FEE_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    // Defensive: only allow keys → finite numbers between 0 and 0.5
    // (50%). Anything else gets dropped — keeps a malformed payload
    // from corrupting the invoice math.
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 0.5) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function setFeeOverride(partnerId: string, feePct: number | null): void {
  if (typeof window === 'undefined') return;
  if (!partnerId) return;
  const next = readFeeOverrides();
  if (feePct === null) {
    delete next[partnerId];
  } else if (Number.isFinite(feePct) && feePct >= 0 && feePct <= 0.5) {
    next[partnerId] = feePct;
  } else {
    return;
  }
  try {
    window.localStorage.setItem(FEE_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage full / disabled — accept the in-session change anyway. */
  }
}

/**
 * Resolve the effective fee % for a partner: override > vertical
 * default. Used everywhere we need the rate at render time.
 */
export function effectiveFeePct(partnerId: string, product: string): number {
  const overrides = readFeeOverrides();
  if (partnerId in overrides) return overrides[partnerId]!;
  return VERTICAL_FEE_PCT[productToVertical(product)];
}

/** True when this partner has an explicit override (vs inheriting). */
export function hasFeeOverride(partnerId: string): boolean {
  return partnerId in readFeeOverrides();
}

export interface InvoiceComputeInput {
  partnerId: string;
  product: string;
  /**
   * Net cents funded in the invoicing period. This is the merchant's
   * gross funded volume for the period — the source of the fee.
   */
  fundedNetCents: number;
}

export interface ComputedInvoice {
  partnerId: string;
  grossFundedCents: number;
  feePct: number;
  /** True when this fee came from a per-merchant override; false when
   *  it came from the vertical default. UI uses this to badge the
   *  row. */
  overridden: boolean;
  feeAmountCents: number;
}

export function computeInvoiceForPartner(input: InvoiceComputeInput): ComputedInvoice {
  const overrides = readFeeOverrides();
  const overridden = input.partnerId in overrides;
  const feePct = overridden
    ? overrides[input.partnerId]!
    : VERTICAL_FEE_PCT[productToVertical(input.product)];
  const feeAmountCents = Math.round(input.fundedNetCents * feePct);
  return {
    partnerId: input.partnerId,
    grossFundedCents: input.fundedNetCents,
    feePct,
    overridden,
    feeAmountCents,
  };
}

/* ──────────────────────────────────────────────────────────────────
 *  Per-invoice status + amount override store
 * ──────────────────────────────────────────────────────────────────
 *  Keyed by invoiceNo → { status, customFeeCents }. The accounts
 *  team can flip status (Draft → Sent → Paid → Overdue) and
 *  override the calculated fee amount per invoice for one-off
 *  credits / concessions / clawbacks.
 */

const INVOICE_STORE_KEY = 'eazepay_invoice_overrides_v1';

export type PaymentMethod = 'ach' | 'wire' | 'card' | 'check' | 'other';

export interface InvoicePayment {
  id: string;
  amountCents: number;
  paidAt: string; // ISO date
  method: PaymentMethod;
  reference?: string;
  note?: string;
  recordedAt: string; // ISO timestamp
}

export type ActivityKind =
  | 'status'
  | 'fee_pct'
  | 'fee_amount'
  | 'due_date'
  | 'payment'
  | 'void'
  | 'unvoid'
  | 'send';

export interface InvoiceActivity {
  id: string;
  at: string; // ISO timestamp
  kind: ActivityKind;
  by: string; // actor (admin@eaze.test in demo)
  summary: string;
}

export type ConfirmState = 'pending' | 'confirmed' | 'disputed';

export interface ConfirmRecord {
  token: string;
  state: ConfirmState;
  /** ISO timestamp the recipient acted (confirmed or disputed). */
  actedAt?: string;
  /** Reason given on dispute. */
  disputeReason?: string;
}

export interface InvoiceOverride {
  status?: InvoiceStatus;
  customFeeCents?: number;
  dueDate?: string; // ISO YYYY-MM-DD
  voidedAt?: string;
  voidReason?: string;
  payments?: InvoicePayment[];
  activity?: InvoiceActivity[];
  /**
   * Confirm/dispute link state — the Send composer mints a token,
   * the recipient clicks the link in the email and lands on
   * /invoices/confirm/<token> where they Confirm or Dispute.
   */
  confirm?: ConfirmRecord;
}

// SSR-safe runtime guard for tag values like InvoiceStatus / PaymentMethod.
const STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];
const METHODS: PaymentMethod[] = ['ach', 'wire', 'card', 'check', 'other'];

function parsePayments(input: unknown): InvoicePayment[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: InvoicePayment[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (
      typeof p.id !== 'string' ||
      typeof p.amountCents !== 'number' ||
      !Number.isFinite(p.amountCents) ||
      typeof p.paidAt !== 'string' ||
      typeof p.method !== 'string' ||
      !METHODS.includes(p.method as PaymentMethod) ||
      typeof p.recordedAt !== 'string'
    ) {
      continue;
    }
    out.push({
      id: p.id,
      amountCents: Math.round(p.amountCents),
      paidAt: p.paidAt,
      method: p.method as PaymentMethod,
      reference: typeof p.reference === 'string' ? p.reference : undefined,
      note: typeof p.note === 'string' ? p.note : undefined,
      recordedAt: p.recordedAt,
    });
  }
  return out;
}

function parseConfirm(input: unknown): ConfirmRecord | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const c = input as Record<string, unknown>;
  if (typeof c.token !== 'string' || !c.token) return undefined;
  const state =
    c.state === 'pending' || c.state === 'confirmed' || c.state === 'disputed'
      ? (c.state as ConfirmState)
      : 'pending';
  return {
    token: c.token,
    state,
    actedAt: typeof c.actedAt === 'string' ? c.actedAt : undefined,
    disputeReason: typeof c.disputeReason === 'string' ? c.disputeReason : undefined,
  };
}

function parseActivity(input: unknown): InvoiceActivity[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const allowed: ActivityKind[] = [
    'status',
    'fee_pct',
    'fee_amount',
    'due_date',
    'payment',
    'void',
    'unvoid',
    'send',
  ];
  const out: InvoiceActivity[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    if (
      typeof a.id !== 'string' ||
      typeof a.at !== 'string' ||
      typeof a.kind !== 'string' ||
      !allowed.includes(a.kind as ActivityKind) ||
      typeof a.by !== 'string' ||
      typeof a.summary !== 'string'
    ) {
      continue;
    }
    out.push({
      id: a.id,
      at: a.at,
      kind: a.kind as ActivityKind,
      by: a.by,
      summary: a.summary,
    });
  }
  return out;
}

export function readInvoiceOverrides(): Record<string, InvoiceOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(INVOICE_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, InvoiceOverride> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const ov = v as Record<string, unknown>;
      const next: InvoiceOverride = {};
      if (typeof ov.status === 'string' && STATUSES.includes(ov.status as InvoiceStatus)) {
        next.status = ov.status as InvoiceStatus;
      }
      if (typeof ov.customFeeCents === 'number' && Number.isFinite(ov.customFeeCents)) {
        next.customFeeCents = ov.customFeeCents;
      }
      if (typeof ov.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ov.dueDate)) {
        next.dueDate = ov.dueDate;
      }
      if (typeof ov.voidedAt === 'string') next.voidedAt = ov.voidedAt;
      if (typeof ov.voidReason === 'string') next.voidReason = ov.voidReason;
      const payments = parsePayments(ov.payments);
      if (payments) next.payments = payments;
      const activity = parseActivity(ov.activity);
      if (activity) next.activity = activity;
      const confirm = parseConfirm(ov.confirm);
      if (confirm) next.confirm = confirm;
      out[k] = next;
    }
    return out;
  } catch {
    return {};
  }
}

export function setInvoiceOverride(invoiceNo: string, patch: Partial<InvoiceOverride>): void {
  if (typeof window === 'undefined' || !invoiceNo) return;
  const next = readInvoiceOverrides();
  next[invoiceNo] = { ...next[invoiceNo], ...patch };
  try {
    window.localStorage.setItem(INVOICE_STORE_KEY, JSON.stringify(next));
  } catch {
    /* swallow */
  }
}

/* ──────────────────────────────────────────────────────────────────
 *  Activity + payment helpers
 * ──────────────────────────────────────────────────────────────────
 *  Every mutation that the accounts team makes (status flip, fee
 *  edit, payment recorded, void) writes an activity entry so the
 *  drawer can show an audit timeline. Payments are append-only;
 *  voiding marks the invoice voided (status surfaces as Draft + a
 *  red "Void" badge in the UI).
 */

function nowIso(): string {
  return new Date().toISOString();
}

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function appendActivity(invoiceNo: string, entry: Omit<InvoiceActivity, 'id' | 'at'>): void {
  const next = readInvoiceOverrides();
  const cur = next[invoiceNo] ?? {};
  const activity = [...(cur.activity ?? [])];
  activity.unshift({ id: rid('act'), at: nowIso(), ...entry });
  setInvoiceOverride(invoiceNo, { activity });
}

export interface RecordPaymentInput {
  invoiceNo: string;
  amountCents: number;
  paidAt: string; // ISO date
  method: PaymentMethod;
  reference?: string;
  note?: string;
  by: string;
  /** When true, flip status → paid (or remain paid). */
  markPaid?: boolean;
}

export function recordPayment(input: RecordPaymentInput): InvoicePayment {
  const payment: InvoicePayment = {
    id: rid('pay'),
    amountCents: Math.max(0, Math.round(input.amountCents)),
    paidAt: input.paidAt,
    method: input.method,
    reference: input.reference,
    note: input.note,
    recordedAt: nowIso(),
  };
  const cur = readInvoiceOverrides()[input.invoiceNo] ?? {};
  const payments = [...(cur.payments ?? []), payment];
  setInvoiceOverride(input.invoiceNo, {
    payments,
    ...(input.markPaid ? { status: 'paid' as InvoiceStatus } : {}),
  });
  appendActivity(input.invoiceNo, {
    kind: 'payment',
    by: input.by,
    summary: `Recorded ${(input.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} via ${input.method.toUpperCase()}${input.reference ? ` (ref ${input.reference})` : ''}`,
  });
  return payment;
}

export function voidInvoice(invoiceNo: string, reason: string, by: string): void {
  setInvoiceOverride(invoiceNo, {
    voidedAt: nowIso(),
    voidReason: reason,
    status: 'draft',
  });
  appendActivity(invoiceNo, {
    kind: 'void',
    by,
    summary: `Voided · ${reason || 'no reason given'}`,
  });
}

export function unvoidInvoice(invoiceNo: string, by: string): void {
  setInvoiceOverride(invoiceNo, { voidedAt: undefined, voidReason: undefined });
  appendActivity(invoiceNo, { kind: 'unvoid', by, summary: 'Voided state cleared' });
}

export function setDueDate(invoiceNo: string, dueDate: string, by: string): void {
  setInvoiceOverride(invoiceNo, { dueDate });
  appendActivity(invoiceNo, {
    kind: 'due_date',
    by,
    summary: `Due date set to ${dueDate}`,
  });
}

/** Sum of payments against an invoice, in cents. */
export function totalPaidCents(
  invoiceNo: string,
  overrides?: Record<string, InvoiceOverride>,
): number {
  const o = overrides ?? readInvoiceOverrides();
  return (o[invoiceNo]?.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
}

/* ──────────────────────────────────────────────────────────────────
 *  Confirm/dispute link
 * ──────────────────────────────────────────────────────────────────
 *  The Send composer mints a token before sending the email; the
 *  recipient lands on /invoices/confirm/<token> to either confirm
 *  the invoice (default action) or dispute it with a reason. State
 *  feeds the Collections tab and the per-invoice activity log.
 */

function makeToken(invoiceNo: string): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}_${invoiceNo.length}`;
}

export function ensureConfirmToken(invoiceNo: string): string {
  const cur = readInvoiceOverrides()[invoiceNo];
  if (cur?.confirm?.token) return cur.confirm.token;
  const token = makeToken(invoiceNo);
  setInvoiceOverride(invoiceNo, {
    confirm: { token, state: 'pending' },
  });
  return token;
}

export function findInvoiceByConfirmToken(
  token: string,
): { invoiceNo: string; record: ConfirmRecord } | null {
  if (!token) return null;
  const all = readInvoiceOverrides();
  for (const [invoiceNo, ov] of Object.entries(all)) {
    if (ov.confirm?.token === token) {
      return { invoiceNo, record: ov.confirm };
    }
  }
  return null;
}

export function setConfirmState(
  invoiceNo: string,
  next: ConfirmState,
  by: string,
  disputeReason?: string,
): void {
  const cur = readInvoiceOverrides()[invoiceNo];
  const token = cur?.confirm?.token ?? makeToken(invoiceNo);
  setInvoiceOverride(invoiceNo, {
    confirm: {
      token,
      state: next,
      actedAt: new Date().toISOString(),
      disputeReason: next === 'disputed' ? disputeReason : undefined,
    },
  });
  appendActivity(invoiceNo, {
    kind: 'status',
    by,
    summary:
      next === 'confirmed'
        ? 'Recipient confirmed invoice'
        : next === 'disputed'
          ? `Recipient disputed${disputeReason ? ` · ${disputeReason}` : ''}`
          : 'Confirm/dispute reset',
  });
}
