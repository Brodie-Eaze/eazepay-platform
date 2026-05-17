'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  InfoIcon,
  ArrowRightIcon,
  SearchIcon,
  type ButtonVariant,
  type ButtonSize,
  Button as _Button,
} from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';
import {
  VERTICAL_FEE_PCT,
  type InvoiceStatus,
  computeInvoiceForPartner,
} from '../../lib/invoicing';

/**
 * Master Invoices — replaces the old /payouts page.
 *
 * Why this page exists
 * --------------------
 * EazePay invoices its merchants a percentage of the volume funded
 * through the platform — we DO NOT pay merchants. The fee varies by
 * vertical (MedPay = 3.5%, TradePay = 5%, CoachPay = 6%, multi-brand
 * blended = 4.5%). This page rolls up every invoice we've issued or
 * are about to issue, by merchant, with status (draft / sent / paid /
 * overdue) and a Send / Mark paid affordance.
 *
 *   Eyebrow MASTER · Title "Invoices"
 *   Sub "Issued and pending merchant invoices · fees by vertical"
 *   KPI cards: OUTSTANDING · PAID THIS MONTH · OVERDUE · AVG FEE %
 *   Filters: [Search merchants…] · [Status: All / Draft / Sent / Paid / Overdue]
 *   Rows per merchant: invoice no · merchant · vertical · period
 *                       · gross funded · fee % · fee $ · status · due
 *
 * Click-through to /invoices/[partnerId] for the per-merchant detail
 * (line items, payment history, download PDF).
 */

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
  feeAmountCents: number;
  status: InvoiceStatus;
  dueDate: string;
}

function fmtUsd(cents: number) {
  const n = Math.round(cents / 100);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US')}`;
}

function fmtPct(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  children?: React.ReactNode;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

const STATUS_TONE: Record<InvoiceStatus, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-bg-muted', text: 'text-fg-secondary', dot: 'bg-slate-400' },
  sent: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

const PERIOD = 'May 2026';

// Build one invoice per partner from the canonical roster. Status is
// deterministic on partnerId so refreshes don't flip rows around.
const SEED: InvoiceRow[] = MASTER_PARTNERS.map((p, i) => {
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
    feeAmountCents: invoice.feeAmountCents,
    status,
    dueDate: '2026-05-31',
  };
});

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

  const rows = useMemo(() => {
    return SEED.filter((r) => {
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
  }, [filter, search]);

  const totalOutstanding = SEED.filter((r) => r.status === 'sent' || r.status === 'overdue').reduce(
    (s, r) => s + r.feeAmountCents,
    0,
  );
  const totalPaid = SEED.filter((r) => r.status === 'paid').reduce(
    (s, r) => s + r.feeAmountCents,
    0,
  );
  const totalOverdue = SEED.filter((r) => r.status === 'overdue').reduce(
    (s, r) => s + r.feeAmountCents,
    0,
  );
  const avgFeePct = SEED.reduce((s, r) => s + r.feePct, 0) / Math.max(1, SEED.length);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Invoices"
        description="Issued and pending merchant invoices · platform fees by vertical"
      />
      <PageBody>
        {/* Inline alert: fee schedule */}
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
              <strong>Multi-brand {fmtPct(VERTICAL_FEE_PCT.multi)}</strong>. Per-merchant overrides
              live on each control-panel page.
            </div>
          </CardBody>
        </Card>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi label="Outstanding" value={fmtUsd(totalOutstanding)} hint="awaiting payment" />
          <Kpi label="Paid this month" value={fmtUsd(totalPaid)} hint={PERIOD} />
          <Kpi label="Overdue" value={fmtUsd(totalOverdue)} hint="past due date" />
          <Kpi label="Avg fee" value={fmtPct(avgFeePct)} hint="weighted by merchant" />
        </div>

        {/* Filters */}
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

        {/* Invoice rows */}
        <Card>
          <CardBody className="p-0">
            {/* Column header strip */}
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/30">
              <span className="col-span-3">Invoice · Merchant</span>
              <span className="col-span-2">Vertical · Period</span>
              <span className="col-span-2 text-right">Gross funded</span>
              <span className="col-span-1 text-right">Fee %</span>
              <span className="col-span-2 text-right">Fee amount</span>
              <span className="col-span-2 text-right">Status · Due</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.length === 0 ? (
                <li className="px-5 py-10 text-center text-fg-muted text-[13px]">
                  No invoices match the current filters.
                </li>
              ) : (
                rows.map((r) => {
                  const tone = STATUS_TONE[r.status];
                  return (
                    <li key={r.invoiceNo}>
                      <Link
                        href={`/invoices/${r.partnerId}`}
                        className="grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-bg-muted/40"
                      >
                        <div className="col-span-3 flex items-center gap-3 min-w-0">
                          <span className="size-9 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[11px] shrink-0">
                            {r.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-fg truncate">
                              {r.merchant}
                            </p>
                            <p className="text-[11px] text-fg-muted truncate font-mono">
                              {r.invoiceNo}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-2 min-w-0">
                          <p className="text-[13px] text-fg truncate">{r.vertical}</p>
                          <p className="text-[11px] text-fg-muted truncate">{r.periodLabel}</p>
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-[13px] text-fg">
                          {fmtUsd(r.grossFundedCents)}
                        </div>
                        <div className="col-span-1 text-right tabular-nums text-[13px] text-fg-secondary">
                          {fmtPct(r.feePct)}
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-[14px] font-semibold text-fg">
                          {fmtUsd(r.feeAmountCents)}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone.bg} ${tone.text}`}
                          >
                            <span className={`size-1.5 rounded-full ${tone.dot}`} />
                            {STATUS_LABEL[r.status]}
                          </span>
                          <ArrowRightIcon size={12} className="text-fg-muted" />
                        </div>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </CardBody>
        </Card>

        {/* Bulk actions */}
        <div className="flex items-center justify-between mt-4 text-[12px] text-fg-secondary">
          <span>
            Showing <strong>{rows.length}</strong> of {SEED.length} invoices
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => flash('Drafts queued for review')}>
              Generate next batch
            </Button>
            <Button size="sm" onClick={() => flash('All sent invoices marked as paid')}>
              Mark all sent as paid
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
