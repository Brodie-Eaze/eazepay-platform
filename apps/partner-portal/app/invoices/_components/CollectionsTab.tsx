'use client';
import { useMemo, useState } from 'react';
import { Button } from '@eazepay/ui/web';
import {
  readInvoiceOverrides,
  setInvoiceOverride,
  appendActivity,
  type InvoiceStatus,
} from '../../../lib/invoicing';
import { partners as MASTER_PARTNERS } from '../../../lib/master-data';
import {
  classifyStage,
  daysOverdue,
  STAGE_LABEL,
  STAGE_TONE,
  STAGE_NEXT_ACTION,
  type CollectionsStage,
} from '../../../lib/billing-collections';
import { hydrateInvoice } from '../../../lib/billing-generator';
import type { Period } from '../../../lib/billing-period';
import { SendDialog, type SendTarget } from './SendDialog';
import { InvoiceDrawer, type DrawerInvoice } from './InvoiceDrawer';

const ACTOR = 'admin@eaze.test';

function fmtUsd(c: number) {
  return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CollectionsRow {
  invoiceNo: string;
  partnerId: string;
  merchant: string;
  email: string;
  vertical: string;
  periodLabel: string;
  amountCents: number;
  paidCents: number;
  dueDate: string;
  daysLate: number;
  stage: CollectionsStage;
  status: InvoiceStatus;
  feePct: number;
  grossFundedCents: number;
}

interface Props {
  flash: (m: string) => void;
  version: number;
  bumpVersion: () => void;
}

const STAGE_ORDER: CollectionsStage[] = [
  'reminder_1',
  'reminder_2',
  'collections',
  'escalated',
  'partial',
  'current',
  'paid',
];

/**
 * Collections lane — every Sent / Overdue / Partial invoice across
 * every period, grouped by dunning stage so the accounts team can
 * work top-down (oldest debt first).
 */
export function CollectionsTab({ flash, version, bumpVersion }: Props) {
  const [stageFilter, setStageFilter] = useState<CollectionsStage | 'all'>('all');
  const [drawerInvoice, setDrawerInvoice] = useState<DrawerInvoice | null>(null);
  const [sendTarget, setSendTarget] = useState<SendTarget | null>(null);

  const rows: CollectionsRow[] = useMemo(() => {
    const all = readInvoiceOverrides();
    const today = new Date();
    const result: CollectionsRow[] = [];
    for (const [invoiceNo, ov] of Object.entries(all)) {
      if (ov.voidedAt) continue;
      if (!invoiceNo.startsWith('INV-')) continue;
      const parts = invoiceNo.split('-');
      if (parts.length < 4) continue;
      const periodId = `${parts[1]}-${parts[2]}`;
      const partnerId = parts.slice(3).join('-');
      const partner = MASTER_PARTNERS.find((p) => p.id === partnerId);
      if (!partner) continue;
      const period: Period = {
        id: periodId,
        label: '',
        startDate: '',
        endDate: '',
        dueDate: ov.dueDate ?? '',
        cycle: 'monthly',
      };
      const hydrated = hydrateInvoice(invoiceNo, period);
      if (!hydrated) continue;
      const status = (ov.status as InvoiceStatus) ?? 'draft';
      // Surface every sent/overdue/paid invoice in collections — paid
      // ones live in the "Paid" stage so reps can see the wins flow.
      if (status === 'draft') continue;
      const payments = ov.payments ?? [];
      const paid = payments.reduce((s, p) => s + p.amountCents, 0);
      const stage = classifyStage(
        status,
        hydrated.dueDate,
        payments,
        hydrated.feeAmountCents,
        today,
      );
      result.push({
        invoiceNo,
        partnerId,
        merchant: partner.legalName,
        email: partner.email,
        vertical: partner.product,
        periodLabel: hydrated.periodLabel,
        amountCents: hydrated.feeAmountCents,
        paidCents: paid,
        dueDate: hydrated.dueDate,
        daysLate: Math.max(0, daysOverdue(hydrated.dueDate, today)),
        stage,
        status,
        feePct: hydrated.feePct,
        grossFundedCents: hydrated.grossFundedCents,
      });
    }
    result.sort((a, b) => {
      const sa = STAGE_ORDER.indexOf(a.stage);
      const sb = STAGE_ORDER.indexOf(b.stage);
      if (sa !== sb) return sa - sb;
      return b.daysLate - a.daysLate;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const stageTotals = useMemo(() => {
    const t = new Map<CollectionsStage, { count: number; amount: number }>();
    for (const r of rows) {
      const cur = t.get(r.stage) ?? { count: 0, amount: 0 };
      cur.count++;
      cur.amount += r.amountCents - r.paidCents;
      t.set(r.stage, cur);
    }
    return t;
  }, [rows]);

  const filtered = stageFilter === 'all' ? rows : rows.filter((r) => r.stage === stageFilter);

  const send = (r: CollectionsRow) => {
    setSendTarget({
      invoiceNo: r.invoiceNo,
      merchant: r.merchant,
      email: r.email,
      subject: `${STAGE_NEXT_ACTION[r.stage]} · ${r.invoiceNo} · ${fmtUsd(r.amountCents)}`,
      body: '',
      amountCents: r.amountCents,
      partnerId: r.partnerId,
      periodLabel: r.periodLabel,
      feePct: r.feePct,
      dueDate: r.dueDate,
      grossFundedCents: r.grossFundedCents,
    });
  };

  const markPaid = (r: CollectionsRow) => {
    setInvoiceOverride(r.invoiceNo, { status: 'paid' });
    appendActivity(r.invoiceNo, {
      kind: 'status',
      by: ACTOR,
      summary: 'Status → Paid (collections quick-action)',
    });
    bumpVersion();
    flash(`${r.invoiceNo} → Paid`);
  };

  const openDrawer = (r: CollectionsRow) => {
    const ov = readInvoiceOverrides()[r.invoiceNo] ?? {};
    setDrawerInvoice({
      invoiceNo: r.invoiceNo,
      merchant: r.merchant,
      email: r.email,
      partnerId: r.partnerId,
      vertical: r.vertical,
      periodLabel: r.periodLabel,
      grossFundedCents: r.grossFundedCents,
      feePct: r.feePct,
      feeAmountCents: r.amountCents,
      status: r.status,
      dueDate: r.dueDate,
      voided: !!ov.voidedAt,
      voidReason: ov.voidReason,
      payments: ov.payments ?? [],
      activity: ov.activity ?? [],
    });
  };

  return (
    <>
      {/* Stage chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StageChip
          label="All"
          count={rows.length}
          active={stageFilter === 'all'}
          onClick={() => setStageFilter('all')}
        />
        {STAGE_ORDER.map((stage) => {
          const total = stageTotals.get(stage);
          if (!total || total.count === 0) return null;
          const tone = STAGE_TONE[stage];
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              className={
                `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition ${tone.bg} ${tone.text} ring-1 ${tone.ring} ` +
                (stageFilter === stage ? 'ring-2 ring-offset-1 ring-fg' : '')
              }
            >
              {STAGE_LABEL[stage]}
              <span className="opacity-70">·</span>
              <span className="tabular-nums">{total.count}</span>
              <span className="opacity-70">·</span>
              <span className="tabular-nums">{fmtUsd(total.amount)}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-border bg-bg-muted/30 text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
          <span className="col-span-3">Merchant · Invoice</span>
          <span className="col-span-2">Period</span>
          <span className="col-span-1 text-right">Amount</span>
          <span className="col-span-1 text-right">Paid</span>
          <span className="col-span-1 text-right">Days late</span>
          <span className="col-span-2">Stage</span>
          <span className="col-span-2 text-right">Actions</span>
        </div>
        <ul className="divide-y divide-border">
          {filtered.length === 0 ? (
            <li className="px-5 py-12 text-center text-fg-muted text-[13px]">
              Nothing in {stageFilter === 'all' ? 'collections' : STAGE_LABEL[stageFilter]} 🎉
            </li>
          ) : (
            filtered.map((r) => {
              const tone = STAGE_TONE[r.stage];
              return (
                <li
                  key={r.invoiceNo}
                  className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-bg-muted/30 transition cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    openDrawer(r);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openDrawer(r)}
                    className="col-span-3 text-left min-w-0 group"
                  >
                    <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">
                      {r.merchant}
                    </p>
                    <p className="text-[11px] text-fg-muted truncate font-mono">{r.invoiceNo}</p>
                  </button>
                  <div className="col-span-2 text-[12px] text-fg-secondary truncate">
                    {r.periodLabel}
                  </div>
                  <div className="col-span-1 text-right tabular-nums text-[13px] font-semibold">
                    {fmtUsd(r.amountCents)}
                  </div>
                  <div className="col-span-1 text-right tabular-nums text-[12px] text-fg-secondary">
                    {fmtUsd(r.paidCents)}
                  </div>
                  <div className="col-span-1 text-right tabular-nums text-[13px] font-semibold">
                    {r.daysLate > 0 ? `+${r.daysLate}` : '—'}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ${tone.bg} ${tone.text} ring-1 ${tone.ring}`}
                    >
                      {STAGE_LABEL[r.stage]}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {r.stage !== 'paid' && (
                      <>
                        <Button size="sm" onClick={() => send(r)}>
                          {STAGE_NEXT_ACTION[r.stage]}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => markPaid(r)}>
                          Mark paid
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

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
          bumpVersion();
          flash(`Sent ${invoiceNo}`);
          setSendTarget(null);
        }}
      />
    </>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition ' +
        (active
          ? 'bg-fg text-bg-elevated'
          : 'bg-bg-elevated border border-border text-fg-secondary hover:bg-bg-muted/60')
      }
    >
      {label}
      <span className="opacity-70">·</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
