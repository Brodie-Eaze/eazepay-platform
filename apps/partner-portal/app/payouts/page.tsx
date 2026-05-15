'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  InfoIcon,
  ClockIcon,
  ArrowRightIcon,
  Button as _Button,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  children?: React.ReactNode;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

/**
 * All Payouts — direct port of Lovable's `/admin/payouts` page.
 *
 *   Eyebrow MASTER · Title "All Payouts"
 *   Sub "View funded applications, fees, and payout schedules for each partner"
 *   Info banner: "Payout Schedule: Payouts are processed on the 1st
 *                  and 15th of each month. Next: May 15, 2026 & Jun 1, 2026"
 *   4 KPI cards: TOTAL FUNDED $684K · TOTAL FEES $68K ·
 *                NET PAYOUTS $616K · PAID OUT $0K
 *   Filter [All Months]
 *   Rows: avatar · name · "<n> funded" chip · "Pending payout" status
 *                · email · • Net: $<amount>
 */

interface PartnerPayoutRow {
  partnerId: string;
  initials: string;
  name: string;
  funded: number;
  email: string;
  netDollars: number;
  status: 'Pending payout' | 'Paid';
}

// Source from canonical master roster so /control-panel cross-links land here.
const SEED: PartnerPayoutRow[] = MASTER_PARTNERS.map((p, i) => ({
  partnerId: p.id,
  initials: p.initials,
  name: p.legalName,
  funded: p.fundedCount,
  email: p.email,
  netDollars: Math.round(p.netCents / 100),
  status: i % 4 === 0 ? 'Paid' : 'Pending payout',
}));

const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function AllPayoutsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const totalFunded = SEED.reduce((s, p) => s + p.netDollars, 0);
  const pending = SEED.filter((p) => p.status === 'Pending payout');
  const pendingTotal = pending.reduce((s, p) => s + p.netDollars, 0);
  const paidTotal = totalFunded - pendingTotal;
  const fees = Math.round(totalFunded * 0.1);
  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="All Payouts"
        description="View funded applications, fees, and payout schedules for each partner"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => flash('Reconciliation export queued')}>
              Export reconciliation
            </Button>
            <Button size="sm" variant="primary" onClick={() => flash(`Queued ${pending.length} partner payout${pending.length === 1 ? '' : 's'} for RTP delivery`)}>
              Run payout batch
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 mb-5 flex items-start gap-3">
          <InfoIcon size={16} className="text-fg shrink-0 mt-0.5" />
          <p className="text-[13px] text-fg-secondary">
            <span className="font-semibold">Payout Schedule:</span> Payouts are processed on the
            1st and 15th of each month. Next: May 15, 2026 &amp; Jun 1, 2026
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi label="Total Funded" value={`$${Math.round(totalFunded / 1000)}K`} />
          <Kpi label="Total Fees" value={`$${Math.round(fees / 1000)}K`} />
          <Kpi label="Net Payouts" value={`$${Math.round((totalFunded - fees) / 1000)}K`} />
          <Kpi label="Paid Out" value={`$${Math.round(paidTotal / 1000)}K`} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => flash('Month picker coming soon')} className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg-secondary hover:bg-bg-muted">
            <ClockIcon size={14} />
            All Months
          </button>
          <span className="text-[12px] text-fg-muted">
            {SEED.length} partner{SEED.length === 1 ? '' : 's'} · {pending.length} pending payout{pending.length === 1 ? '' : 's'}
          </span>
        </div>

        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {SEED.map((p) => (
                <li key={p.email}>
                  <Link
                    href={`/payouts/${p.partnerId}`}
                    className="grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-bg-muted/40 cursor-pointer"
                  >
                  <div className="col-span-7 flex items-center gap-3 min-w-0">
                    <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                      {p.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                        {p.name}
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted px-2 py-0.5 rounded-full shrink-0">
                          {p.funded} funded
                        </span>
                        <span className="text-[10px] font-semibold text-fg-secondary bg-bg-muted border border-border px-2 py-0.5 rounded-full shrink-0">
                          {p.status}
                        </span>
                      </p>
                      <p className="text-[12px] text-fg-muted truncate mt-0.5">{p.email}</p>
                    </div>
                  </div>
                  <div className="col-span-4 text-right">
                    <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold">Net</p>
                    <p className="text-[15px] font-bold text-fg tabular-nums">{fmt(p.netDollars)}</p>
                  </div>
                  <ArrowRightIcon size={14} className="text-fg-muted col-span-1 justify-self-end" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-tight text-fg leading-none">{value}</p>
    </div>
  );
}
