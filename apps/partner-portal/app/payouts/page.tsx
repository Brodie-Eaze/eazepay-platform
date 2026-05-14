'use client';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  InfoIcon,
  ClockIcon,
  ArrowRightIcon,
} from '@eazepay/ui/web';

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

const SEED: PartnerPayoutRow[] = [
  { partnerId: 'premier',    initials: 'PR', name: 'Premier Coaching Group', funded: 6, email: 'sarah@premiercoaching.com',  netDollars: 258_300, status: 'Pending payout' },
  { partnerId: 'medfirst',   initials: 'ME', name: 'MedFirst Solutions',     funded: 3, email: 'james@medfirst.com',         netDollars: 175_500, status: 'Pending payout' },
  { partnerId: 'tradeforce', initials: 'TR', name: 'TradeForce Pro',         funded: 2, email: 'mike@tradeforce.com',        netDollars: 99_000,  status: 'Pending payout' },
  { partnerId: 'dental',     initials: 'DE', name: 'Dental Care Partners',   funded: 1, email: 'amy@dentalcarepartners.com', netDollars: 82_800,  status: 'Pending payout' },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function AllPayoutsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="All Payouts"
        description="View funded applications, fees, and payout schedules for each partner"
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
          <Kpi label="Total Funded" value="$684K" />
          <Kpi label="Total Fees" value="$68K" />
          <Kpi label="Net Payouts" value="$616K" />
          <Kpi label="Paid Out" value="$0K" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg-secondary hover:bg-bg-muted">
            <ClockIcon size={14} />
            All Months
          </button>
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
