'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CheckIcon, DocIcon, SendIcon, ChevronDownIcon } from '@eazepay/ui/web';
import {
  readInvoiceOverrides,
  setInvoiceOverride,
  setFeeOverride,
  appendActivity,
  type InvoiceStatus,
  type InvoicePayment,
  type InvoiceActivity,
} from '../../../lib/invoicing';
import {
  applyInvoiceFilter,
  DEFAULT_FILTER,
  type InvoiceFilter,
  type SortKey,
} from '../../../lib/invoice-filter';
import { rowsToCsv, downloadCsv } from '../../../lib/invoice-csv';
import { hydrateInvoice, invoiceNoFor } from '../../../lib/billing-generator';
import { partners as MASTER_PARTNERS } from '../../../lib/master-data';
import type { Period } from '../../../lib/billing-period';
import { InvoiceDrawer, type DrawerInvoice } from './InvoiceDrawer';
import { SendDialog, type SendTarget } from './SendDialog';

const ACTOR = 'admin@eaze.test';

interface Row {
  invoiceNo: string;
  partnerId: string;
  initials: string;
  merchant: string;
  email: string;
  vertical: string;
  periodLabel: string;
  grossFundedCents: number;
  feePct: number;
  feeAmountCents: number;
  feeOverridden: boolean;
  feeAmountOverridden: boolean;
  status: InvoiceStatus;
  dueDate: string;
  voided?: boolean;
  voidReason?: string;
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

const PencilIcon = ({ size = 9 }: { size?: number }) => (
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

interface Props {
  period: Period;
  flash: (m: string) => void;
  version: number;
  bumpVersion: () => void;
}

/**
 * Monthly billing tab — the period-scoped invoice list. Reads the
 * set of invoices that exist for `period.id`; doesn't auto-create
 * anything (the "Generate from activity" button in the page shell
 * does that).
 */
export function MonthlyBillingTab({ period, flash, version, bumpVersion }: Props) {
  const [filter, setFilter] = useState<InvoiceFilter>(DEFAULT_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerInvoice, setDrawerInvoice] = useState<DrawerInvoice | null>(null);
  const [sendTarget, setSendTarget] = useState<SendTarget | null>(null);

  const [editingFeeFor, setEditingFeeFor] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState('');
  const [editingAmountFor, setEditingAmountFor] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

  /**
   * Build rows only for invoice numbers that actually exist for this
   * period (i.e. have been generated). Empty state surfaces in the UI
   * if none exist yet.
   */
  const rows: Row[] = useMemo(() => {
    const overrides = readInvoiceOverrides();
    const prefix = `INV-${period.id}-`;
    const ids = Object.keys(overrides).filter((id) => id.startsWith(prefix));
    return ids
      .map((id) => {
        const hydrated = hydrateInvoice(id, period);
        if (!hydrated) return null;
        const ov = overrides[id]!;
        const partner = MASTER_PARTNERS.find((p) => p.id === hydrated.partnerId);
        return {
          invoiceNo: hydrated.invoiceNo,
          partnerId: hydrated.partnerId,
          initials: partner?.initials ?? hydrated.merchant.slice(0, 2).toUpperCase(),
          merchant: hydrated.merchant,
          email: hydrated.email,
          vertical: hydrated.vertical,
          periodLabel: hydrated.periodLabel,
          grossFundedCents: hydrated.grossFundedCents,
          feePct: hydrated.feePct,
          feeAmountCents: hydrated.feeAmountCents,
          feeOverridden: false, // computed dynamically below if needed
          feeAmountOverridden: typeof ov.customFeeCents === 'number',
          status: (ov.status as InvoiceStatus) ?? 'draft',
          dueDate: hydrated.dueDate,
          voided: !!ov.voidedAt,
          voidReason: ov.voidReason,
          payments: ov.payments ?? [],
          activity: ov.activity ?? [],
        } as Row;
      })
      .filter((r): r is Row => r !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.id, version]);

  const filtered = useMemo(() => applyInvoiceFilter(rows, filter), [rows, filter]);

  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.invoiceNo)), [filtered]);
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => visibleIds.has(id) && next.add(id));
      return next;
    });
  }, [visibleIds]);

  /* ─── Edit handlers ───────────────────────────────────────────── */

  const startEditFee = (r: Row) => {
    setEditingFeeFor(r.invoiceNo);
    setEditingFeeValue((r.feePct * 100).toFixed(2));
  };
  const commitEditFee = (r: Row) => {
    const n = Number(editingFeeValue);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      flash('Fee must be between 0 and 50%.');
      setEditingFeeFor(null);
      return;
    }
    const prev = (r.feePct * 100).toFixed(2);
    if (Number(prev) === n) {
      setEditingFeeFor(null);
      return;
    }
    setFeeOverride(r.partnerId, n / 100);
    appendActivity(r.invoiceNo, {
      kind: 'fee_pct',
      by: ACTOR,
      summary: `Fee % set to ${n.toFixed(2)}% (was ${prev}%)`,
    });
    setEditingFeeFor(null);
    bumpVersion();
    flash(`${r.merchant} fee → ${n.toFixed(2)}%`);
  };
  const startEditAmount = (r: Row) => {
    setEditingAmountFor(r.invoiceNo);
    setEditingAmountValue((r.feeAmountCents / 100).toFixed(2));
  };
  const commitEditAmount = (r: Row) => {
    const n = Number(editingAmountValue);
    if (!Number.isFinite(n) || n < 0) {
      flash('Amount must be a positive number.');
      setEditingAmountFor(null);
      return;
    }
    const cents = Math.round(n * 100);
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

  /* ─── Drawer / Send ──────────────────────────────────────────── */

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

  const openSend = useCallback((r: Row) => {
    setSendTarget({
      invoiceNo: r.invoiceNo,
      merchant: r.merchant,
      email: r.email,
      subject: `Invoice ${r.invoiceNo} · ${r.periodLabel} · ${fmtUsd(r.feeAmountCents)}`,
      body: '', // SendDialog fills the body from the template with confirm+pay links
      amountCents: r.feeAmountCents,
      partnerId: r.partnerId,
      periodLabel: r.periodLabel,
      feePct: r.feePct,
      dueDate: r.dueDate,
      grossFundedCents: r.grossFundedCents,
    });
  }, []);

  const handleSendComplete = (invoiceNo: string) => {
    const r = rows.find((x) => x.invoiceNo === invoiceNo);
    if (!r) return;
    if (r.status === 'draft') {
      setInvoiceOverride(r.invoiceNo, { status: 'sent' });
      appendActivity(r.invoiceNo, {
        kind: 'status',
        by: ACTOR,
        summary: 'Status → Sent (auto on send)',
      });
    }
    bumpVersion();
  };

  /* ─── Bulk ───────────────────────────────────────────────────── */

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  const bulkMarkPaid = () => {
    const target = selected.size > 0 ? selectedRows : rows.filter((r) => r.status === 'sent');
    let count = 0;
    for (const r of target) {
      if (r.status === 'sent' || r.status === 'overdue') {
        setInvoiceOverride(r.invoiceNo, { status: 'paid' });
        appendActivity(r.invoiceNo, {
          kind: 'status',
          by: ACTOR,
          summary: 'Status → Paid (bulk action)',
        });
        count++;
      }
    }
    bumpVersion();
    setSelected(new Set());
    flash(`Marked ${count} as paid`);
  };
  const bulkExportCsv = () => {
    const target = selected.size > 0 ? selectedRows : filtered;
    if (target.length === 0) {
      flash('Nothing to export.');
      return;
    }
    const csv = rowsToCsv(target);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`eazepay-invoices-${period.id}-${stamp}.csv`, csv);
    flash(`Exported ${target.length} row${target.length === 1 ? '' : 's'}`);
  };

  /* ─── Sort header ─────────────────────────────────────────────── */

  const setSort = (key: SortKey) => {
    setFilter((f) =>
      f.sort === key
        ? { ...f, dir: f.dir === 'asc' ? 'desc' : 'asc' }
        : { ...f, sort: key, dir: key === 'merchant' || key === 'vertical' ? 'asc' : 'desc' },
    );
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
    return (
      <button
        type="button"
        onClick={() => setSort(sortKey)}
        className={`col-span-${span} text-[10px] uppercase tracking-wider font-semibold inline-flex items-center gap-1 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'} transition`}
      >
        {label}
        <span className="text-[8px] leading-none w-2">
          {active ? (filter.dir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
          <input
            placeholder="Search invoice no, merchant, email…"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="flex-1 bg-transparent outline-none text-[13px]"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => setFilter({ ...filter, search: '' })}
              className="text-[11px] text-fg-muted hover:text-fg"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['all', ...STATUS_ORDER] as const).map((s) => {
            const active = filter.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter({ ...filter, status: s })}
                className={
                  'h-9 px-3 rounded-lg text-[12px] font-semibold transition-colors ' +
                  (active
                    ? 'bg-fg text-bg-elevated'
                    : 'bg-bg-elevated border border-border text-fg-secondary hover:bg-bg-muted/60')
                }
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-border bg-bg-muted/30 items-center">
          <label className="col-span-1 flex items-center gap-2 cursor-pointer">
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
          <SortHeader label="Vertical" sortKey="vertical" align="left" span={2} />
          <SortHeader label="Gross funded" sortKey="gross" align="right" span={2} />
          <SortHeader label="Fee %" sortKey="feePct" align="right" span={1} />
          <SortHeader label="Amount" sortKey="feeAmount" align="right" span={2} />
          <SortHeader label="Due" sortKey="dueDate" align="right" span={1} />
          <SortHeader label="Status · Actions" sortKey="status" align="right" span={3} />
        </div>
        <ul className="divide-y divide-border">
          {filtered.length === 0 ? (
            <li className="px-5 py-12 text-center text-fg-muted text-[13px]">
              No invoices for {period.label} yet. Click <strong>"Generate from activity"</strong>{' '}
              above to build drafts.
            </li>
          ) : (
            filtered.map((r) => {
              const tone = STATUS_TONE[r.status];
              const editingFee = editingFeeFor === r.invoiceNo;
              const editingAmount = editingAmountFor === r.invoiceNo;
              const isSelected = selected.has(r.invoiceNo);
              const paidCents = r.payments.reduce((s, p) => s + p.amountCents, 0);
              return (
                <li
                  key={r.invoiceNo}
                  className={`grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-bg-muted/30 transition cursor-pointer ${r.voided ? 'opacity-60' : ''}`}
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('button, input, select, textarea, label')) return;
                    openDrawer(r);
                  }}
                >
                  <div className="col-span-1 flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(r.invoiceNo)}
                      aria-label={`Select ${r.invoiceNo}`}
                    />
                    <span className="size-8 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[10px]">
                      {r.initials}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDrawer(r)}
                    className="col-span-2 text-left min-w-0 group"
                  >
                    <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">
                      {r.merchant}
                    </p>
                    <p className="text-[11px] text-fg-muted truncate font-mono">
                      {r.invoiceNo}
                      {r.voided && <span className="ml-1.5 text-rose-600 font-semibold">VOID</span>}
                    </p>
                  </button>
                  <div className="col-span-2 min-w-0">
                    <p className="text-[13px] text-fg truncate">{r.vertical}</p>
                    <p className="text-[11px] text-fg-muted truncate">{r.periodLabel}</p>
                  </div>
                  <div className="col-span-2 text-right tabular-nums text-[13px] text-fg">
                    {fmtUsdCompact(r.grossFundedCents)}
                  </div>
                  <div className="col-span-1 text-right">
                    {editingFee ? (
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
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditFee(r)}
                        className="inline-flex items-center gap-1 text-[13px] tabular-nums text-fg-secondary hover:text-fg border-b border-dashed border-fg-muted/40 hover:border-fg/60 pb-px"
                        title="Click to edit"
                      >
                        <span className="text-fg-muted opacity-60">
                          <PencilIcon />
                        </span>
                        {fmtPct(r.feePct)}
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
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditAmount(r)}
                        className="inline-flex items-center gap-1 text-[14px] tabular-nums font-semibold text-fg border-b border-dashed border-fg-muted/40 hover:border-fg/60 pb-px"
                        title="Click to edit"
                      >
                        <span className="text-fg-muted opacity-60">
                          <PencilIcon />
                        </span>
                        {fmtUsdCompact(r.feeAmountCents)}
                        {r.feeAmountOverridden && (
                          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                        )}
                      </button>
                    )}
                    {paidCents > 0 && paidCents < r.feeAmountCents && (
                      <p className="text-[10px] text-amber-700 mt-0.5">{fmtUsd(paidCents)} paid</p>
                    )}
                  </div>
                  <div className="col-span-1 text-right text-[11px] text-fg-muted tabular-nums">
                    {r.dueDate.slice(5).replace('-', '/')}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
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
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openSend(r)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-secondary hover:text-fg px-2 py-1 rounded transition hover:bg-bg-muted/60"
                    >
                      <SendIcon size={11} />
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => openDrawer(r)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-secondary hover:text-fg px-2 py-1 rounded transition hover:bg-bg-muted/60"
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
      </div>

      {/* Footer + bulk bar */}
      <div className="flex items-center justify-between mt-4 text-[12px] text-fg-secondary">
        <span>
          {filtered.length} of {rows.length} invoices
          {selected.size > 0 && <span className="ml-2 text-fg">· {selected.size} selected</span>}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={bulkExportCsv}>
            <DocIcon size={12} />
            Export CSV
          </Button>
          <Button size="sm" onClick={bulkMarkPaid}>
            <CheckIcon size={12} />
            {selected.size > 0 ? `Mark ${selected.size} paid` : 'Mark sent as paid'}
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
          <span className="opacity-40">·</span>
          <Button size="sm" variant="ghost" onClick={bulkExportCsv}>
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={bulkMarkPaid}>
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

      <InvoiceDrawer
        invoice={drawerInvoice}
        actor={ACTOR}
        onClose={() => setDrawerInvoice(null)}
        onMutated={bumpVersion}
      />
      <SendDialog
        target={sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={(invoiceNo) => {
          handleSendComplete(invoiceNo);
          setSendTarget(null);
        }}
      />
    </>
  );
}
