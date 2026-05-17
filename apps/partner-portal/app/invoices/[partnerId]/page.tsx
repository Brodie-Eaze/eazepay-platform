'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  InfoIcon,
  ArrowRightIcon,
  type ButtonVariant,
  type ButtonSize,
  Button as _Button,
} from '@eazepay/ui/web';
import { findPartner } from '../../../lib/master-data';
import { VERTICAL_FEE_PCT, computeInvoiceForPartner } from '../../../lib/invoicing';

/**
 * Per-merchant Invoices — drill from /invoices into a single merchant
 * to see their billing history, line items, payment events.
 *
 * Mock surface for now: shows the current-period invoice computed from
 * the partner's funded volume + the vertical fee schedule, plus 5
 * synthetic historical invoices so the page has texture. Real billing
 * lines will come from the FinOps service once it lands.
 */

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  children?: React.ReactNode;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

function fmtUsd(cents: number) {
  const n = cents / 100;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtUsdCompact(cents: number) {
  const n = Math.round(cents / 100);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US')}`;
}
function fmtPct(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

const MONTHS = ['May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026', 'Dec 2025'];

const STATUS_TONE = {
  draft: { bg: 'bg-bg-muted', text: 'text-fg-secondary', dot: 'bg-slate-400', label: 'Draft' },
  sent: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Sent' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Paid' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Overdue' },
} as const;

type Status = keyof typeof STATUS_TONE;

export default function MerchantInvoicesPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const partner = findPartner(partnerId);
  if (!partner) notFound();

  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const thisPeriod = computeInvoiceForPartner({
    partnerId: partner.id,
    product: partner.product,
    fundedNetCents: partner.netCents,
  });

  // Synth a 6-month history: a smooth declining/recovering volume
  // around the current month so the chart of past invoices has shape.
  const history = MONTHS.map((month, i) => {
    const wobble = 1 - i * 0.04 + (i % 2 === 0 ? 0.03 : -0.02);
    const fundedCents = Math.round(partner.netCents * wobble);
    const calc = computeInvoiceForPartner({
      partnerId: partner.id,
      product: partner.product,
      fundedNetCents: fundedCents,
    });
    const statusCycle: Status[] = ['sent', 'paid', 'paid', 'paid', 'paid', 'paid'];
    return {
      invoiceNo: `INV-${month.replace(' ', '').toUpperCase()}-${partner.id.slice(-3).toUpperCase()}`,
      period: month,
      grossFundedCents: calc.grossFundedCents,
      feeAmountCents: calc.feeAmountCents,
      status: statusCycle[i]!,
    };
  });

  const ytdFeeCents = history.reduce((s, h) => s + h.feeAmountCents, 0);
  const outstandingCents = history
    .filter((h) => h.status === 'sent' || h.status === 'overdue')
    .reduce((s, h) => s + h.feeAmountCents, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master' },
          { label: 'Invoices', href: '/invoices' },
          { label: partner.legalName },
        ]}
        title={partner.legalName}
        description={`${partner.product} · invoicing history`}
        actions={
          <Link href="/invoices">
            <Button variant="ghost">← Back to invoices</Button>
          </Link>
        }
      />
      <PageBody>
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi label="This period" value={fmtUsd(thisPeriod.feeAmountCents)} hint="May 2026" />
          <Kpi
            label="Fee rate"
            value={fmtPct(thisPeriod.feePct)}
            hint={`${partner.product} default`}
          />
          <Kpi
            label="Outstanding"
            value={fmtUsdCompact(outstandingCents)}
            hint="across all periods"
          />
          <Kpi label="YTD billed" value={fmtUsdCompact(ytdFeeCents)} hint="last 6 months" />
        </div>

        {/* Active invoice card */}
        <Card className="mb-5">
          <CardBody className="px-5 py-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
                  Current period
                </p>
                <h2 className="text-[18px] font-semibold tracking-tight text-fg mt-1">
                  May 2026 invoice
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => flash('PDF ready')}>
                  Download PDF
                </Button>
                <Button size="sm" onClick={() => flash('Invoice sent')}>
                  Send invoice
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <div className="rounded-lg border border-border bg-bg-muted/30 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                  Gross funded
                </p>
                <p className="mt-1 text-[18px] font-semibold tabular-nums text-fg">
                  {fmtUsd(thisPeriod.grossFundedCents)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-bg-muted/30 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                  Fee rate
                </p>
                <p className="mt-1 text-[18px] font-semibold tabular-nums text-fg">
                  {fmtPct(thisPeriod.feePct)}
                </p>
                <p className="text-[11px] text-fg-muted mt-1">
                  Default for {partner.product}. Override on Control Panel.
                </p>
              </div>
              <div className="rounded-lg border border-fg/20 bg-fg/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                  Fee due
                </p>
                <p className="mt-1 text-[20px] font-bold tabular-nums text-fg">
                  {fmtUsd(thisPeriod.feeAmountCents)}
                </p>
                <p className="text-[11px] text-fg-muted mt-1">Due May 31, 2026</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Historical invoices */}
        <Card>
          <CardBody className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-[14px] font-semibold text-fg">Historical invoices</h3>
              <span className="text-[12px] text-fg-muted">{history.length} periods</span>
            </div>
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/30">
              <span className="col-span-3">Invoice</span>
              <span className="col-span-2">Period</span>
              <span className="col-span-3 text-right">Gross funded</span>
              <span className="col-span-2 text-right">Fee</span>
              <span className="col-span-2 text-right">Status</span>
            </div>
            <ul className="divide-y divide-border">
              {history.map((h) => {
                const tone = STATUS_TONE[h.status];
                return (
                  <li
                    key={h.invoiceNo}
                    className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-bg-muted/30"
                  >
                    <div className="col-span-3 min-w-0">
                      <p className="text-[12px] font-mono text-fg truncate">{h.invoiceNo}</p>
                    </div>
                    <div className="col-span-2 text-[13px] text-fg-secondary">{h.period}</div>
                    <div className="col-span-3 text-right tabular-nums text-[13px] text-fg">
                      {fmtUsd(h.grossFundedCents)}
                    </div>
                    <div className="col-span-2 text-right tabular-nums text-[13px] font-semibold text-fg">
                      {fmtUsd(h.feeAmountCents)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone.bg} ${tone.text}`}
                      >
                        <span className={`size-1.5 rounded-full ${tone.dot}`} />
                        {tone.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <p className="mt-3 text-[11px] text-fg-muted flex items-center gap-1.5">
          <InfoIcon size={11} />
          Per-merchant fee overrides are configured on Control Panel → Billing (not yet wired). All
          invoice math reads from the vertical defaults — MedPay {fmtPct(VERTICAL_FEE_PCT.medpay)},
          TradePay {fmtPct(VERTICAL_FEE_PCT.tradepay)}, CoachPay {fmtPct(VERTICAL_FEE_PCT.coachpay)}
          , Multi-brand {fmtPct(VERTICAL_FEE_PCT.multi)}.
        </p>

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
