'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  InfoIcon,
  SearchIcon,
  SendIcon,
  CheckIcon,
  DocIcon,
  ChevronDownIcon,
} from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';
import {
  VERTICAL_FEE_PCT,
  computeInvoiceForPartner,
  setFeeOverride,
  readInvoiceOverrides,
  setInvoiceOverride,
  appendActivity,
  type InvoiceStatus,
  type InvoicePayment,
  type InvoiceActivity,
} from '../../lib/invoicing';
import {
  applyInvoiceFilter,
  DEFAULT_FILTER,
  isOverdueByDate,
  type DateRange,
  type SortKey,
  type SortDir,
  type InvoiceFilter,
  type FilterableInvoice,
} from '../../lib/invoice-filter';
import { rowsToCsv, downloadCsv } from '../../lib/invoice-csv';
import { InvoiceDrawer, type DrawerInvoice } from './_components/InvoiceDrawer';
import { SendDialog, type SendTarget } from './_components/SendDialog';

/**
 * Master Invoices — accounts-team workspace.
 *
 * Per-row: click % / amount to edit, status dropdown, send (composer
 * dialog), open row → drawer for record-payment / void / due-date /
 * activity. Filters: search, status, date range. Sortable columns.
 * Bulk: mark sent → paid, send, void, CSV-export selected. All edits
 * land in localStorage today and write an activity-log entry; the
 * accounts team gets a full audit trail per invoice.
 */

const ACTOR = 'admin@eaze.test';
const PERIOD = 'May 2026';

interface Row extends FilterableInvoice {
  partnerId: string;
  initials: string;
  feeOverridden: boolean;
  feeAmountOverridden: boolean;
  payments: InvoicePayment[];
  activity: InvoiceActivity[];
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

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'last3Months', label: 'Last 3 months' },
];

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

const PencilIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

function buildSeed(): Row[] {
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
      voided: false,
      payments: [],
      activity: [],
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
  const [filter, setFilter] = useState<InvoiceFilter>(DEFAULT_FILTER);
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Inline editors
  const [editingFeeFor, setEditingFeeFor] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState('');
  const [editingAmountFor, setEditingAmountFor] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

  // Modals
  const [drawerInvoice, setDrawerInvoice] = useState<DrawerInvoice | null>(null);
  const [sendTarget, setSendTarget] = useState<SendTarget | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows: Row[] = useMemo(() => {
    const seed = buildSeed();
    const overrides = readInvoiceOverrides();
    const today = new Date();
    return seed.map((r) => {
      const ov = overrides[r.invoiceNo];
      const voided = !!ov?.voidedAt;
      const dueDate = ov?.dueDate ?? r.dueDate;
      const customAmount = typeof ov?.customFeeCents === 'number' ? ov.customFeeCents : null;
      const baseStatus = ov?.status ?? r.status;
      // Auto-promote sent → overdue when past due (visible flag only —
      // doesn't write back, so accounts can still flip it manually).
      const status: InvoiceStatus =
        baseStatus === 'sent' && isOverdueByDate(dueDate, today) ? 'overdue' : baseStatus;
      return {
        ...r,
        status,
        dueDate,
        voided,
        voidReason: ov?.voidReason,
        feeAmountCents: customAmount ?? r.feeAmountCents,
        feeAmountOverridden: customAmount !== null,
        payments: ov?.payments ?? [],
        activity: ov?.activity ?? [],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const filtered = useMemo(() => applyInvoiceFilter(rows, filter), [rows, filter]);

  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.invoiceNo)), [filtered]);
  // Drop selections that are no longer in view (filter changed) — keeps
  // the bulk bar honest about how many invoices the action would touch.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [visibleIds]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    let overdue = 0;
    let feeSum = 0;
    for (const r of rows) {
      if (r.voided) continue;
      if (r.status === 'sent') outstanding += r.feeAmountCents;
      if (r.status === 'overdue') {
        outstanding += r.feeAmountCents;
        overdue += r.feeAmountCents;
      }
      if (r.status === 'paid') paid += r.feeAmountCents;
      feeSum += r.feePct;
    }
    return {
      outstanding,
      paid,
      overdue,
      avgFeePct: feeSum / Math.max(1, rows.length),
    };
  }, [rows]);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  /* ─── Inline edit handlers ─────────────────────────────────────── */

  const startEditFee = (r: Row) => {
    setEditingFeeFor(r.invoiceNo);
    setEditingFeeValue((r.feePct * 100).toFixed(2));
  };
  const commitEditFee = (r: Row) => {
    const next = Number(editingFeeValue);
    if (!Number.isFinite(next) || next < 0 || next > 50) {
      flash('Fee must be between 0 and 50%.');
      setEditingFeeFor(null);
      return;
    }
    const prev = (r.feePct * 100).toFixed(2);
    if (Number(prev) === next) {
      setEditingFeeFor(null);
      return;
    }
    setFeeOverride(r.partnerId, next / 100);
    appendActivity(r.invoiceNo, {
      kind: 'fee_pct',
      by: ACTOR,
      summary: `Fee % set to ${next.toFixed(2)}% (was ${prev}%)`,
    });
    setEditingFeeFor(null);
    bumpVersion();
    flash(`${r.merchant} fee → ${next.toFixed(2)}%`);
  };
  const resetFee = (r: Row) => {
    setFeeOverride(r.partnerId, null);
    appendActivity(r.invoiceNo, {
      kind: 'fee_pct',
      by: ACTOR,
      summary: 'Fee % reset to vertical default',
    });
    bumpVersion();
    flash(`${r.merchant} fee reset to vertical default`);
  };

  const startEditAmount = (r: Row) => {
    setEditingAmountFor(r.invoiceNo);
    setEditingAmountValue((r.feeAmountCents / 100).toFixed(2));
  };
  const commitEditAmount = (r: Row) => {
    const next = Number(editingAmountValue);
    if (!Number.isFinite(next) || next < 0) {
      flash('Amount must be a positive number.');
      setEditingAmountFor(null);
      return;
    }
    const cents = Math.round(next * 100);
    if (cents === r.feeAmountCents) {
      setEditingAmountFor(null);
      return;
    }
    setInvoiceOverride(r.invoiceNo, { customFeeCents: cents });
    appendActivity(r.invoiceNo, {
      kind: 'fee_amount',
      by: ACTOR,
      summary: `Amount set to ${fmtUsd(cents)} (was ${fmtUsd(r.feeAmountCents)})`,
    });
    setEditingAmountFor(null);
    bumpVersion();
    flash(`${r.invoiceNo} → ${fmtUsd(cents)}`);
  };
  const resetAmount = (r: Row) => {
    setInvoiceOverride(r.invoiceNo, { customFeeCents: undefined });
    appendActivity(r.invoiceNo, {
      kind: 'fee_amount',
      by: ACTOR,
      summary: 'Amount restored to calculated value',
    });
    bumpVersion();
    flash(`${r.invoiceNo} amount restored`);
  };

  const setStatus = (r: Row, status: InvoiceStatus) => {
    setInvoiceOverride(r.invoiceNo, { status });
    appendActivity(r.invoiceNo, {
      kind: 'status',
      by: ACTOR,
      summary: `Status → ${STATUS_LABEL[status]} (was ${STATUS_LABEL[r.status]})`,
    });
    bumpVersion();
    flash(`${r.invoiceNo} → ${STATUS_LABEL[status]}`);
  };

  /* ─── Send (composer) ─────────────────────────────────────────── */

  const buildDefaultSend = (r: Row): SendTarget => {
    const subject = `Your ${r.vertical} platform-fee invoice — ${r.invoiceNo} (${r.periodLabel})`;
    const body =
      `Hi ${r.merchant} team,\n\n` +
      `Please find your ${r.periodLabel} EazePay platform-fee invoice summary below.\n\n` +
      `Invoice:      ${r.invoiceNo}\n` +
      `Period:       ${r.periodLabel}\n` +
      `Gross funded: ${fmtUsd(r.grossFundedCents)}\n` +
      `Fee rate:     ${fmtPct(r.feePct)}\n` +
      `Fee due:      ${fmtUsd(r.feeAmountCents)}\n` +
      `Due date:     ${r.dueDate}\n\n` +
      `Please remit by the due date. Reply to this email if anything needs reconciling.\n\n` +
      `— EazePay FinOps`;
    return { invoiceNo: r.invoiceNo, merchant: r.merchant, email: r.email, subject, body };
  };

  const openSend = (r: Row) => setSendTarget(buildDefaultSend(r));

  const finalizeSend = (final: { subject: string; body: string }) => {
    if (!sendTarget) return;
    const target = sendTarget;
    const params = `?subject=${encodeURIComponent(final.subject)}&body=${encodeURIComponent(final.body)}`;
    const href = `mailto:${encodeURIComponent(target.email)}${params}`;
    if (typeof window !== 'undefined') window.location.href = href;
    const r = rows.find((x) => x.invoiceNo === target.invoiceNo);
    if (r) {
      appendActivity(r.invoiceNo, {
        kind: 'send',
        by: ACTOR,
        summary: `Composed email to ${r.email}`,
      });
      if (r.status === 'draft') {
        setInvoiceOverride(r.invoiceNo, { status: 'sent' });
        appendActivity(r.invoiceNo, {
          kind: 'status',
          by: ACTOR,
          summary: 'Status → Sent (auto on send)',
        });
      }
      bumpVersion();
    }
    setSendTarget(null);
  };

  /* ─── Bulk ─────────────────────────────────────────────────────── */

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.invoiceNo)));
  };
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.invoiceNo)),
    [filtered, selected],
  );

  const bulkMarkSentAsPaid = () => {
    const target = selected.size > 0 ? selectedRows : rows.filter((r) => r.status === 'sent');
    let count = 0;
    for (const r of target) {
      if (r.status === 'sent' || r.status === 'overdue') {
        setInvoiceOverride(r.invoiceNo, { status: 'paid' });
        appendActivity(r.invoiceNo, {
          kind: 'status',
          by: ACTOR,
          summary: `Status → Paid (bulk action)`,
        });
        count++;
      }
    }
    bumpVersion();
    setSelected(new Set());
    flash(`Marked ${count} invoice${count === 1 ? '' : 's'} as paid`);
  };

  const bulkExportCsv = () => {
    const target = selected.size > 0 ? selectedRows : filtered;
    if (target.length === 0) {
      flash('Nothing to export.');
      return;
    }
    const csv = rowsToCsv(target);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`eazepay-invoices-${stamp}.csv`, csv);
    flash(`Exported ${target.length} row${target.length === 1 ? '' : 's'} to CSV`);
  };

  const bulkSend = () => {
    if (selectedRows.length === 0) return;
    if (selectedRows.length > 10) {
      flash('Cap of 10 per bulk-send to keep things humane. Select fewer.');
      return;
    }
    selectedRows.forEach((r) => openSend(r));
    // Note: only opens the LAST in this iteration — composer flow is
    // intentionally one-at-a-time so accounts review per-email before
    // hitting send.
    flash(`Opening composer for ${selectedRows[0]?.merchant}`);
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

  /* ─── Drawer wiring ───────────────────────────────────────────── */

  const openDrawer = (r: Row) => {
    setDrawerInvoice({
      invoiceNo: r.invoiceNo,
      merchant: r.merchant,
      email: r.email,
      partnerId: r.partnerId,
      vertical: r.vertical,
      periodLabel: r.periodLabel,
      grossFundedCents: r.grossFundedCents,
      feePct: r.feePct,
      feeAmountCents: r.feeAmountCents,
      status: r.status,
      dueDate: r.dueDate,
      voided: r.voided ?? false,
      voidReason: r.voidReason,
      payments: r.payments,
      activity: r.activity,
    });
  };

  // Keep drawer in sync after mutations (status flips, payments, void).
  useEffect(() => {
    if (!drawerInvoice) return;
    const refreshed = rows.find((r) => r.invoiceNo === drawerInvoice.invoiceNo);
    if (!refreshed) {
      setDrawerInvoice(null);
      return;
    }
    setDrawerInvoice({
      ...drawerInvoice,
      status: refreshed.status,
      dueDate: refreshed.dueDate,
      feeAmountCents: refreshed.feeAmountCents,
      voided: refreshed.voided ?? false,
      voidReason: refreshed.voidReason,
      payments: refreshed.payments,
      activity: refreshed.activity,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  /* ─── Sortable header ─────────────────────────────────────────── */

  const setSort = (key: SortKey) => {
    setFilter((f) => {
      if (f.sort === key) {
        return { ...f, dir: f.dir === 'asc' ? 'desc' : 'asc' } as InvoiceFilter;
      }
      return { ...f, sort: key, dir: key === 'merchant' || key === 'vertical' ? 'asc' : 'desc' };
    });
  };

  const SortHeader = ({
    label,
    sortKey,
    align,
    span,
  }: {
    label: string;
    sortKey: SortKey;
    align: 'left' | 'right';
    span: number;
  }) => {
    const active = filter.sort === sortKey;
    const arrow = active ? (filter.dir === 'asc' ? '▲' : '▼') : '';
    return (
      <button
        type="button"
        onClick={() => setSort(sortKey)}
        className={`col-span-${span} text-[10px] uppercase tracking-wider font-semibold inline-flex items-center gap-1 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'} transition`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[8px] leading-none w-2">{arrow}</span>
      </button>
    );
  };

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
            <div className="flex-1 text-[13px] text-fg-secondary leading-relaxed">
              <strong className="text-fg">Accounts team workflow.</strong> Click a fee % or fee
              amount to edit (orange dot = override). Click any row to open the detail drawer for
              recording payments, editing the due date, voiding, and viewing the full activity log.
              Defaults by vertical: <strong>MedPay {fmtPct(VERTICAL_FEE_PCT.medpay)}</strong>,{' '}
              <strong>TradePay {fmtPct(VERTICAL_FEE_PCT.tradepay)}</strong>,{' '}
              <strong>CoachPay {fmtPct(VERTICAL_FEE_PCT.coachpay)}</strong>,{' '}
              <strong>Multi-brand {fmtPct(VERTICAL_FEE_PCT.multi)}</strong>.
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi
            label="Outstanding"
            value={fmtUsdCompact(totals.outstanding)}
            hint="awaiting payment"
          />
          <Kpi label="Paid this month" value={fmtUsdCompact(totals.paid)} hint={PERIOD} />
          <Kpi label="Overdue" value={fmtUsdCompact(totals.overdue)} hint="past due date" />
          <Kpi label="Avg fee" value={fmtPct(totals.avgFeePct)} hint="weighted by merchant" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search invoice no, merchant, email…"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
              aria-label="Search invoices"
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => setFilter({ ...filter, search: '' })}
                className="text-[11px] text-fg-muted hover:text-fg"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => {
              const active = filter.status === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter({ ...filter, status: f.id })}
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
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {DATE_RANGES.map((d) => {
              const active = filter.dateRange === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setFilter({ ...filter, dateRange: d.id })}
                  className={
                    'h-8 px-2.5 rounded-md text-[11px] font-medium transition-colors ' +
                    (active
                      ? 'bg-bg-muted text-fg'
                      : 'text-fg-muted hover:text-fg hover:bg-bg-muted/40')
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-border bg-bg-muted/30 items-center">
              <label className="col-span-1 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length;
                  }}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                  Invoice
                </span>
              </label>
              <SortHeader label="Vertical · Period" sortKey="vertical" align="left" span={2} />
              <SortHeader label="Gross funded" sortKey="gross" align="right" span={2} />
              <SortHeader label="Fee %" sortKey="feePct" align="right" span={1} />
              <SortHeader label="Fee amount" sortKey="feeAmount" align="right" span={2} />
              <SortHeader label="Due" sortKey="dueDate" align="right" span={1} />
              <SortHeader label="Status · Actions" sortKey="status" align="right" span={3} />
            </div>
            <ul className="divide-y divide-border">
              {filtered.length === 0 ? (
                <li className="px-5 py-10 text-center text-fg-muted text-[13px]">
                  No invoices match the current filters.
                </li>
              ) : (
                filtered.map((r) => {
                  const row = r as Row;
                  const tone = STATUS_TONE[row.status];
                  const editingFee = editingFeeFor === row.invoiceNo;
                  const editingAmount = editingAmountFor === row.invoiceNo;
                  const isSelected = selected.has(row.invoiceNo);
                  const paidCents = row.payments.reduce((s, p) => s + p.amountCents, 0);
                  return (
                    <li
                      key={row.invoiceNo}
                      className={`grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-bg-muted/30 transition cursor-pointer ${row.voided ? 'opacity-60' : ''}`}
                      onClick={(e) => {
                        // Don't open drawer when clicking inputs / buttons inside the row.
                        const t = e.target as HTMLElement;
                        if (t.closest('button, input, select, textarea, a, label')) return;
                        openDrawer(row);
                      }}
                    >
                      <div className="col-span-1 flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(row.invoiceNo)}
                          aria-label={`Select ${row.invoiceNo}`}
                        />
                        <span className="size-8 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[10px] shrink-0">
                          {row.initials}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openDrawer(row)}
                        className="col-span-2 text-left min-w-0 group"
                      >
                        <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">
                          {row.merchant}
                        </p>
                        <p className="text-[11px] text-fg-muted truncate font-mono">
                          {row.invoiceNo}
                          {row.voided && (
                            <span className="ml-1.5 text-rose-600 font-semibold">VOID</span>
                          )}
                        </p>
                      </button>

                      <div className="col-span-2 min-w-0">
                        <p className="text-[13px] text-fg truncate">{row.vertical}</p>
                        <p className="text-[11px] text-fg-muted truncate">{row.periodLabel}</p>
                      </div>

                      <div className="col-span-2 text-right tabular-nums text-[13px] text-fg">
                        {fmtUsdCompact(row.grossFundedCents)}
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
                                if (e.key === 'Enter') commitEditFee(row);
                                if (e.key === 'Escape') setEditingFeeFor(null);
                              }}
                              onBlur={() => commitEditFee(row)}
                              className="w-14 h-7 px-1.5 text-right rounded border border-border-focus bg-bg-elevated text-[12px] tabular-nums outline-none ring-2 ring-border-focus/20"
                              aria-label={`Fee % for ${row.merchant}`}
                            />
                            <span className="text-[11px] text-fg-muted">%</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditFee(row)}
                            className="inline-flex items-center gap-1 text-[13px] tabular-nums text-fg-secondary hover:text-fg transition border-b border-dashed border-fg-muted/40 hover:border-fg/60 pb-px"
                            title="Click to edit fee % (per-merchant override)"
                          >
                            <span className="text-fg-muted opacity-60">
                              <PencilIcon size={9} />
                            </span>
                            {fmtPct(row.feePct)}
                            {row.feeOverridden && (
                              <span
                                className="size-1.5 rounded-full bg-amber-500"
                                title="Per-merchant override active"
                                aria-hidden
                              />
                            )}
                          </button>
                        )}
                        {row.feeOverridden && !editingFee && (
                          <button
                            type="button"
                            onClick={() => resetFee(row)}
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
                                if (e.key === 'Enter') commitEditAmount(row);
                                if (e.key === 'Escape') setEditingAmountFor(null);
                              }}
                              onBlur={() => commitEditAmount(row)}
                              className="w-24 h-7 px-1.5 text-right rounded border border-border-focus bg-bg-elevated text-[12px] tabular-nums outline-none ring-2 ring-border-focus/20"
                              aria-label={`Fee amount for ${row.invoiceNo}`}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditAmount(row)}
                            className="inline-flex items-center gap-1 text-[14px] tabular-nums font-semibold text-fg transition border-b border-dashed border-fg-muted/40 hover:border-fg/60 pb-px"
                            title="Click to edit invoice amount"
                          >
                            <span className="text-fg-muted opacity-60">
                              <PencilIcon size={9} />
                            </span>
                            {fmtUsdCompact(row.feeAmountCents)}
                            {row.feeAmountOverridden && (
                              <span
                                className="size-1.5 rounded-full bg-amber-500"
                                title="Manual amount override"
                                aria-hidden
                              />
                            )}
                          </button>
                        )}
                        {paidCents > 0 && paidCents < row.feeAmountCents && (
                          <p className="text-[10px] text-amber-700 mt-0.5">
                            {fmtUsd(paidCents)} paid
                          </p>
                        )}
                      </div>

                      <div className="col-span-1 text-right text-[11px] text-fg-muted tabular-nums">
                        {row.dueDate.slice(5).replace('-', '/')}
                      </div>

                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <select
                          value={row.status}
                          onChange={(e) => setStatus(row, e.target.value as InvoiceStatus)}
                          className={`appearance-none cursor-pointer text-[11px] font-semibold px-2.5 py-1 pr-6 rounded-full ${tone.bg} ${tone.text} ring-1 ${tone.ring} focus:outline-none focus:ring-2 focus:ring-border-focus bg-no-repeat`}
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                            backgroundPosition: 'right 6px center',
                            backgroundSize: '10px 10px',
                          }}
                          aria-label={`Status for ${row.invoiceNo}`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openSend(row)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-secondary hover:text-fg px-2 py-1 rounded transition hover:bg-bg-muted/60"
                          title="Send invoice by email"
                        >
                          <SendIcon size={11} />
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={() => openDrawer(row)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-secondary hover:text-fg px-2 py-1 rounded transition hover:bg-bg-muted/60"
                          title="Open details · record payment · void"
                        >
                          Details
                          <ChevronDownIcon size={10} />
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
            {selected.size > 0 && <span className="ml-2 text-fg">· {selected.size} selected</span>}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={bulkExportCsv}>
              <DocIcon size={12} />
              Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => flash('Drafts queued for review')}>
              Generate next batch
            </Button>
            <Button size="sm" onClick={bulkMarkSentAsPaid}>
              <CheckIcon size={12} />
              {selected.size > 0 ? `Mark ${selected.size} as paid` : 'Mark sent as paid'}
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-fg text-bg-elevated px-4 py-2 shadow-lg"
          >
            <span className="text-[12px] font-semibold">{selected.size} selected</span>
            <span className="text-bg-elevated/40">·</span>
            <Button size="sm" variant="ghost" onClick={bulkExportCsv}>
              Export
            </Button>
            <Button size="sm" variant="ghost" onClick={bulkSend}>
              Send
            </Button>
            <Button size="sm" variant="ghost" onClick={bulkMarkSentAsPaid}>
              Mark paid
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[11px] underline-offset-2 hover:underline opacity-80"
            >
              Clear
            </button>
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 rounded-lg bg-fg text-bg-elevated px-4 py-3 text-[13px] font-semibold shadow-lg"
          >
            {toast}
          </div>
        )}

        <InvoiceDrawer
          invoice={drawerInvoice}
          actor={ACTOR}
          onClose={() => setDrawerInvoice(null)}
          onMutated={bumpVersion}
        />
        <SendDialog target={sendTarget} onClose={() => setSendTarget(null)} onSend={finalizeSend} />
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
