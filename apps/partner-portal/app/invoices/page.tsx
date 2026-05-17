'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  InfoIcon,
  SearchIcon,
  SendIcon,
  CheckIcon,
  type ButtonVariant,
  type ButtonSize,
  Button as _Button,
} from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';
import {
  VERTICAL_FEE_PCT,
  type InvoiceStatus,
  computeInvoiceForPartner,
  setFeeOverride,
  readInvoiceOverrides,
  setInvoiceOverride,
} from '../../lib/invoicing';

/**
 * Master Invoices — interactive billing surface for the accounts team.
 *
 * Per-row controls:
 *   • Inline edit of the fee % (writes a per-merchant override that
 *     persists to localStorage; "reset" link clears it back to the
 *     vertical default).
 *   • Status flip (Draft → Sent → Paid → Overdue) via dropdown.
 *   • Edit fee amount (one-off override on the calculated number —
 *     useful for credits / concessions / clawbacks).
 *   • Send via email — opens the OS composer with a prefilled subject
 *     + body addressed to the merchant's contact email.
 *
 * Top-level controls: search + status filter, bulk "mark sent → paid",
 * and a "generate next batch" affordance for the new period.
 *
 * Persistence: localStorage. In production the per-merchant fee
 * override + invoice status flips will round-trip through a BFF
 * endpoint that writes to the FinOps service.
 */

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  children?: React.ReactNode;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

function fmtUsdCompact(cents: number) {
  const n = Math.round(cents / 100);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US')}`;
}
function fmtUsd(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtPct(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

interface InvoiceRow {
  invoiceNo: string;
  partnerId: string;
  initials: string;
  merchant: string;
  email: string;
  vertical: string;
  periodLabel: string;
  grossFundedCents: number;
  feePct: number;
  feeOverridden: boolean;
  feeAmountCents: number;
  feeAmountOverridden: boolean;
  status: InvoiceStatus;
  dueDate: string;
}

const STATUS_TONE: Record<InvoiceStatus, { bg: string; text: string; ring: string }> = {
  draft: { bg: 'bg-bg-muted', text: 'text-fg-secondary', ring: 'ring-border' },
  sent: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200/70' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/70' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200/70' },
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

const STATUS_ORDER: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];

const PERIOD = 'May 2026';

/** Build the base invoice list from the partner roster. */
function buildSeed(): InvoiceRow[] {
  return MASTER_PARTNERS.map((p, i) => {
    const invoice = computeInvoiceForPartner({
      partnerId: p.id,
      product: p.product,
      fundedNetCents: p.netCents,
    });
    const statusCycle: InvoiceStatus[] = ['sent', 'paid', 'sent', 'overdue', 'draft'];
    const status = statusCycle[i % statusCycle.length]!;
    return {
      invoiceNo: `INV-2026-${(1000 + i).toString().slice(1)}`,
      partnerId: p.id,
      initials: p.initials,
      merchant: p.legalName,
      email: p.email,
      vertical: p.product,
      periodLabel: PERIOD,
      grossFundedCents: invoice.grossFundedCents,
      feePct: invoice.feePct,
      feeOverridden: invoice.overridden,
      feeAmountCents: invoice.feeAmountCents,
      feeAmountOverridden: false,
      status,
      dueDate: '2026-05-31',
    };
  });
}

const FILTERS: Array<{ id: 'all' | InvoiceStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [toast, setToast] = useState<string | null>(null);
  /** Bump to re-read fee + invoice overrides after a mutation. */
  const [version, setVersion] = useState(0);

  /** Editor state — which row's fee % is being edited inline. */
  const [editingFeeFor, setEditingFeeFor] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState('');

  /** Editor state — which row's fee amount is being edited inline. */
  const [editingAmountFor, setEditingAmountFor] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

  const rows: InvoiceRow[] = useMemo(() => {
    const seed = buildSeed();
    const overrides = readInvoiceOverrides();
    return seed.map((r) => {
      const ov = overrides[r.invoiceNo];
      const status = ov?.status ?? r.status;
      const amountFromOverride = typeof ov?.customFeeCents === 'number' ? ov.customFeeCents : null;
      return {
        ...r,
        status,
        feeAmountCents: amountFromOverride ?? r.feeAmountCents,
        feeAmountOverridden: amountFromOverride !== null,
      };
    });
    // version dep forces recompute after an override write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (
        search &&
        !r.merchant.toLowerCase().includes(search.toLowerCase()) &&
        !r.email.toLowerCase().includes(search.toLowerCase()) &&
        !r.invoiceNo.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totalOutstanding = rows
    .filter((r) => r.status === 'sent' || r.status === 'overdue')
    .reduce((s, r) => s + r.feeAmountCents, 0);
  const totalPaid = rows
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + r.feeAmountCents, 0);
  const totalOverdue = rows
    .filter((r) => r.status === 'overdue')
    .reduce((s, r) => s + r.feeAmountCents, 0);
  const avgFeePct = rows.reduce((s, r) => s + r.feePct, 0) / Math.max(1, rows.length);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  /* ─── Inline edit handlers ───────────────────────────────── */

  const startEditFee = (r: InvoiceRow) => {
    setEditingFeeFor(r.invoiceNo);
    setEditingFeeValue((r.feePct * 100).toFixed(2));
  };
  const commitEditFee = (r: InvoiceRow) => {
    const next = Number(editingFeeValue);
    if (!Number.isFinite(next) || next < 0 || next > 50) {
      flash('Fee must be between 0 and 50%.');
      setEditingFeeFor(null);
      return;
    }
    setFeeOverride(r.partnerId, next / 100);
    setEditingFeeFor(null);
    bumpVersion();
    flash(`${r.merchant} fee set to ${next.toFixed(2)}%`);
  };
  const resetFee = (r: InvoiceRow) => {
    setFeeOverride(r.partnerId, null);
    bumpVersion();
    flash(`${r.merchant} fee reset to vertical default`);
  };

  const startEditAmount = (r: InvoiceRow) => {
    setEditingAmountFor(r.invoiceNo);
    setEditingAmountValue((r.feeAmountCents / 100).toFixed(2));
  };
  const commitEditAmount = (r: InvoiceRow) => {
    const next = Number(editingAmountValue);
    if (!Number.isFinite(next) || next < 0) {
      flash('Amount must be a positive number.');
      setEditingAmountFor(null);
      return;
    }
    setInvoiceOverride(r.invoiceNo, { customFeeCents: Math.round(next * 100) });
    setEditingAmountFor(null);
    bumpVersion();
    flash(`${r.invoiceNo} amount overridden to ${fmtUsd(Math.round(next * 100))}`);
  };
  const resetAmount = (r: InvoiceRow) => {
    setInvoiceOverride(r.invoiceNo, { customFeeCents: undefined });
    bumpVersion();
    flash(`${r.invoiceNo} amount restored to calculated value`);
  };

  const setStatus = (r: InvoiceRow, status: InvoiceStatus) => {
    setInvoiceOverride(r.invoiceNo, { status });
    bumpVersion();
    flash(`${r.invoiceNo} → ${STATUS_LABEL[status]}`);
  };

  /**
   * Send via email — opens the OS composer with a prefilled subject
   * + body + the merchant contact in To:. Treats sending as the
   * Draft → Sent transition when the row was a draft.
   */
  const sendByEmail = (r: InvoiceRow) => {
    const subject = `Your ${r.vertical} platform-fee invoice — ${r.invoiceNo} (${r.periodLabel})`;
    const body =
      `Hi ${r.merchant} team,\n\n` +
      `Please find your ${r.periodLabel} EazePay platform-fee invoice linked below.\n\n` +
      `Invoice:  ${r.invoiceNo}\n` +
      `Period:   ${r.periodLabel}\n` +
      `Gross funded: ${fmtUsd(r.grossFundedCents)}\n` +
      `Fee rate:  ${fmtPct(r.feePct)}\n` +
      `Fee due:   ${fmtUsd(r.feeAmountCents)}\n` +
      `Due:       ${r.dueDate}\n\n` +
      `Please remit by the due date. Reply to this email if anything needs reconciling.\n\n` +
      `— EazePay FinOps`;
    const params = `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const href = `mailto:${encodeURIComponent(r.email)}${params}`;
    if (typeof window !== 'undefined') window.location.href = href;
    if (r.status === 'draft') setStatus(r, 'sent');
  };

  const bulkMarkSentAsPaid = () => {
    let count = 0;
    rows.forEach((r) => {
      if (r.status === 'sent') {
        setInvoiceOverride(r.invoiceNo, { status: 'paid' });
        count++;
      }
    });
    bumpVersion();
    flash(`Marked ${count} sent invoice${count === 1 ? '' : 's'} as paid`);
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingFeeFor(null);
        setEditingAmountFor(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Invoices"
        description="Issued and pending merchant invoices · platform fees by vertical"
      />
      <PageBody>
        <Card className="mb-4">
          <CardBody className="flex items-start gap-3 px-5 py-4">
            <span className="text-fg-muted mt-0.5">
              <InfoIcon size={16} />
            </span>
            <div className="flex-1 text-[13px] text-fg-secondary">
              <strong className="text-fg">Fee schedule</strong> — EazePay invoices each merchant a
              platform fee on funded volume. Defaults by vertical:{' '}
              <strong>MedPay {fmtPct(VERTICAL_FEE_PCT.medpay)}</strong>,{' '}
              <strong>TradePay {fmtPct(VERTICAL_FEE_PCT.tradepay)}</strong>,{' '}
              <strong>CoachPay {fmtPct(VERTICAL_FEE_PCT.coachpay)}</strong>,{' '}
              <strong>Multi-brand {fmtPct(VERTICAL_FEE_PCT.multi)}</strong>. Click any row's fee %
              to set a per-merchant override.
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi
            label="Outstanding"
            value={fmtUsdCompact(totalOutstanding)}
            hint="awaiting payment"
          />
          <Kpi label="Paid this month" value={fmtUsdCompact(totalPaid)} hint={PERIOD} />
          <Kpi label="Overdue" value={fmtUsdCompact(totalOverdue)} hint="past due date" />
          <Kpi label="Avg fee" value={fmtPct(avgFeePct)} hint="weighted by merchant" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search invoice no, merchant, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={
                    'h-9 px-3 rounded-lg text-[12px] font-semibold transition-colors ' +
                    (active
                      ? 'bg-fg text-bg-elevated'
                      : 'bg-bg-elevated border border-border text-fg-secondary hover:bg-bg-muted/60')
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/30">
              <span className="col-span-3">Invoice · Merchant</span>
              <span className="col-span-2">Vertical · Period</span>
              <span className="col-span-2 text-right">Gross funded</span>
              <span className="col-span-1 text-right">Fee %</span>
              <span className="col-span-2 text-right">Fee amount</span>
              <span className="col-span-2 text-right">Status · Actions</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.length === 0 ? (
                <li className="px-5 py-10 text-center text-fg-muted text-[13px]">
                  No invoices match the current filters.
                </li>
              ) : (
                filtered.map((r) => {
                  const tone = STATUS_TONE[r.status];
                  const editingFee = editingFeeFor === r.invoiceNo;
                  const editingAmount = editingAmountFor === r.invoiceNo;
                  return (
                    <li
                      key={r.invoiceNo}
                      className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-bg-muted/30"
                    >
                      <Link
                        href={`/invoices/${r.partnerId}`}
                        className="col-span-3 flex items-center gap-3 min-w-0 group"
                      >
                        <span className="size-9 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[11px] shrink-0">
                          {r.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">
                            {r.merchant}
                          </p>
                          <p className="text-[11px] text-fg-muted truncate font-mono">
                            {r.invoiceNo}
                          </p>
                        </div>
                      </Link>

                      <div className="col-span-2 min-w-0">
                        <p className="text-[13px] text-fg truncate">{r.vertical}</p>
                        <p className="text-[11px] text-fg-muted truncate">{r.periodLabel}</p>
                      </div>

                      <div className="col-span-2 text-right tabular-nums text-[13px] text-fg">
                        {fmtUsdCompact(r.grossFundedCents)}
                      </div>

                      <div className="col-span-1 text-right">
                        {editingFee ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="50"
                              autoFocus
                              value={editingFeeValue}
                              onChange={(e) => setEditingFeeValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditFee(r);
                                if (e.key === 'Escape') setEditingFeeFor(null);
                              }}
                              onBlur={() => commitEditFee(r)}
                              className="w-14 h-7 px-1.5 text-right rounded border border-border-focus bg-bg-elevated text-[12px] tabular-nums outline-none ring-2 ring-border-focus/20"
                              aria-label={`Fee % for ${r.merchant}`}
                            />
                            <span className="text-[11px] text-fg-muted">%</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditFee(r)}
                            className="inline-flex items-center gap-1 text-[13px] tabular-nums text-fg-secondary hover:text-fg hover:underline underline-offset-2 transition"
                            title="Click to edit fee % (per-merchant override)"
                          >
                            {fmtPct(r.feePct)}
                            {r.feeOverridden && (
                              <span
                                className="size-1.5 rounded-full bg-amber-500"
                                title="Per-merchant override active"
                                aria-hidden
                              />
                            )}
                          </button>
                        )}
                        {r.feeOverridden && !editingFee && (
                          <button
                            type="button"
                            onClick={() => resetFee(r)}
                            className="block ml-auto text-[10px] text-fg-muted hover:text-fg underline-offset-2 hover:underline transition mt-0.5"
                            title="Reset to vertical default"
                          >
                            reset
                          </button>
                        )}
                      </div>

                      <div className="col-span-2 text-right">
                        {editingAmount ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[11px] text-fg-muted">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={editingAmountValue}
                              onChange={(e) => setEditingAmountValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditAmount(r);
                                if (e.key === 'Escape') setEditingAmountFor(null);
                              }}
                              onBlur={() => commitEditAmount(r)}
                              className="w-24 h-7 px-1.5 text-right rounded border border-border-focus bg-bg-elevated text-[12px] tabular-nums outline-none ring-2 ring-border-focus/20"
                              aria-label={`Fee amount for ${r.invoiceNo}`}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditAmount(r)}
                            className="inline-flex items-center gap-1 text-[14px] tabular-nums font-semibold text-fg hover:underline underline-offset-2 transition"
                            title="Click to edit invoice amount"
                          >
                            {fmtUsdCompact(r.feeAmountCents)}
                            {r.feeAmountOverridden && (
                              <span
                                className="size-1.5 rounded-full bg-amber-500"
                                title="Manual amount override"
                                aria-hidden
                              />
                            )}
                          </button>
                        )}
                        {r.feeAmountOverridden && !editingAmount && (
                          <button
                            type="button"
                            onClick={() => resetAmount(r)}
                            className="block ml-auto text-[10px] text-fg-muted hover:text-fg underline-offset-2 hover:underline transition mt-0.5"
                            title="Reset to calculated amount"
                          >
                            reset
                          </button>
                        )}
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <select
                          value={r.status}
                          onChange={(e) => setStatus(r, e.target.value as InvoiceStatus)}
                          className={`appearance-none cursor-pointer text-[11px] font-semibold px-2.5 py-1 pr-6 rounded-full ${tone.bg} ${tone.text} ring-1 ${tone.ring} focus:outline-none focus:ring-2 focus:ring-border-focus bg-no-repeat`}
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                            backgroundPosition: 'right 6px center',
                            backgroundSize: '10px 10px',
                          }}
                          aria-label={`Status for ${r.invoiceNo}`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => sendByEmail(r)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-secondary hover:text-fg px-2 py-1 rounded transition hover:bg-bg-muted/60"
                          title="Send invoice by email"
                        >
                          <SendIcon size={11} />
                          Send
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardBody>
        </Card>

        <div className="flex items-center justify-between mt-4 text-[12px] text-fg-secondary">
          <span>
            Showing <strong>{filtered.length}</strong> of {rows.length} invoices
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => flash('Drafts queued for review')}>
              Generate next batch
            </Button>
            <Button size="sm" onClick={bulkMarkSentAsPaid}>
              <CheckIcon size={12} />
              Mark sent as paid
            </Button>
          </div>
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 rounded-lg bg-fg text-bg-elevated px-4 py-3 text-[13px] font-semibold shadow-lg"
          >
            {toast}
          </div>
        )}
      </PageBody>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-tight text-fg leading-none tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-fg-muted">{hint}</p>}
    </div>
  );
}
