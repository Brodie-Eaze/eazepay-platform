'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import {
  PageBody,
  Card,
  CardBody,
  Button,
  InfoIcon,
  SendIcon,
} from '@eazepay/ui/web';
import { findPartner, applicationsForPartner, PAYOUT_SCHEDULE } from '../../../lib/master-data';

/**
 * Partner Payouts — direct port of Lovable's "click a partner from
 * All Payouts" drill view.
 *
 *   ← Back to All Partners
 *   PARTNER PAYOUTS eyebrow
 *   Partner name h1 · email · phone · industry
 *   [Send All to Accounts] dark CTA top-right
 *   Payout Schedule banner: "Payouts are processed twice monthly on
 *   the 1st and 15th. Next payouts: May 15, 2026 & Jun 1, 2026"
 *
 *   5 KPI cards: TOTAL FUNDED · FEES (10%) · NET PAYOUT · PAID OUT · PENDING
 *
 *   "Funded Applications (N)" with "<n> pending · $X to pay" badge
 *   Table:
 *     ID · CLIENT · PRODUCT · LOAN AMOUNT · FEE · NET PAYOUT · FUNDED · STATUS
 */

interface PayoutRow {
  id: string;
  client: string;
  product: string;
  loanAmount: number;
  fee: number;
  netPayout: number;
  funded: string;
  status: 'Pending' | 'Paid';
}

interface PartnerPayout {
  name: string;
  email: string;
  phone: string;
  industry: string;
  rows: PayoutRow[];
}

const PARTNERS: Record<string, PartnerPayout> = {
  premier: {
    name: 'Premier Coaching Group',
    email: 'sarah@premiercoaching.com',
    phone: '(305) 555-0101',
    industry: 'Coaching',
    rows: [
      { id: 'FA-1001', client: 'John Martinez',  product: 'CoachPay', loanAmount: 45_000, fee: 4_500, netPayout: 40_500, funded: '2026-02-18', status: 'Pending' },
      { id: 'FA-1002', client: 'Lisa Chen',      product: 'CoachPay', loanAmount: 32_000, fee: 3_200, netPayout: 28_800, funded: '2026-02-20', status: 'Pending' },
      { id: 'FA-1005', client: 'Michael Brown',  product: 'CoachPay', loanAmount: 52_000, fee: 5_200, netPayout: 46_800, funded: '2026-02-22', status: 'Pending' },
      { id: 'FA-1008', client: 'Rachel Green',   product: 'CoachPay', loanAmount: 40_000, fee: 4_000, netPayout: 36_000, funded: '2026-02-25', status: 'Pending' },
      { id: 'FA-1011', client: 'Tyler Hughes',   product: 'CoachPay', loanAmount: 37_000, fee: 3_700, netPayout: 33_300, funded: '2026-02-27', status: 'Pending' },
      { id: 'FA-1003', client: 'Robert Davis',   product: 'CoachPay', loanAmount: 81_000, fee: 8_100, netPayout: 72_900, funded: '2026-03-05', status: 'Pending' },
    ],
  },
  medfirst: {
    name: 'MedFirst Solutions', email: 'james@medfirst.com', phone: '(212) 555-0202', industry: 'Medical',
    rows: [
      { id: 'MA-1001', client: 'Robert Kim',     product: 'MedPay', loanAmount: 15_000, fee: 1_500, netPayout: 13_500, funded: '2026-01-20', status: 'Pending' },
      { id: 'MA-1002', client: 'David Park',     product: 'MedPay', loanAmount: 9_500,  fee: 950,   netPayout: 8_550,  funded: '2026-01-10', status: 'Pending' },
      { id: 'MA-1003', client: 'Maria Santos',   product: 'MedPay', loanAmount: 150_000, fee: 15_000, netPayout: 135_000, funded: '2026-02-18', status: 'Pending' },
    ],
  },
  tradeforce: {
    name: 'TradeForce Pro', email: 'mike@tradeforce.com', phone: '(415) 555-0303', industry: 'Trades',
    rows: [
      { id: 'TA-1001', client: 'Lisa Chen',      product: 'TradePay', loanAmount: 45_000, fee: 4_500, netPayout: 40_500, funded: '2026-01-28', status: 'Pending' },
      { id: 'TA-1002', client: 'Mike Henderson', product: 'TradePay', loanAmount: 18_500, fee: 1_850, netPayout: 16_650, funded: '2026-01-15', status: 'Pending' },
    ],
  },
  dental: {
    name: 'Dental Care Partners', email: 'amy@dentalcarepartners.com', phone: '(310) 555-0404', industry: 'Dental',
    rows: [
      { id: 'DA-1001', client: 'Brittany Nguyen', product: 'MedPay', loanAmount: 92_000, fee: 9_200, netPayout: 82_800, funded: '2026-01-25', status: 'Pending' },
    ],
  },
};

const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;

export default function PartnerPayoutsPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  // Same id-bridging dance as /applications/[partnerId]: support both
  // the legacy slug ('premier') and the master id ('p_atlas') so links
  // from /control-panel land here on the right partner.
  let p: PartnerPayout | undefined = PARTNERS[partnerId];
  if (!p) {
    const master = findPartner(partnerId);
    if (master) {
      const masterApps = applicationsForPartner(master.id).filter(
        (a) => a.status === 'funded' || a.status === 'approved',
      );
      const rows: PayoutRow[] = masterApps.map((a, i) => {
        const amount = Math.round(a.amountCents / 100);
        const fee = Math.round(amount * 0.10);
        const productLabel = a.product === 'med-pay' ? 'MedPay' : a.product === 'trade-pay' ? 'TradePay' : 'CoachPay';
        return {
          id: `FA-${master.id.slice(2).toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`,
          client: a.customer,
          product: productLabel,
          loanAmount: amount,
          fee,
          netPayout: amount - fee,
          funded: a.date,
          status: a.status === 'funded' ? 'Paid' : 'Pending',
        };
      });
      p = {
        name: master.legalName,
        email: master.email,
        phone: master.phone ?? '—',
        industry: master.niche.charAt(0).toUpperCase() + master.niche.slice(1),
        rows,
      };
    }
  }
  if (!p) notFound();

  // Modest local UI state: toast for the "Send All to Accounts" CTA and a
  // tracker of rows marked Paid this session so the visible totals shift
  // immediately when the operator triggers the send.
  // We declare these here (after the early return) and TS picks them up
  // because the early-return uses `notFound()` which throws.
  const [toast, setToast] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const adjustedRows = p!.rows.map((r) => (sentIds.has(r.id) ? { ...r, status: 'Paid' as const } : r));

  const totalFunded = adjustedRows.reduce((s, r) => s + r.loanAmount, 0);
  const totalFees = adjustedRows.reduce((s, r) => s + r.fee, 0);
  const netPayout = adjustedRows.reduce((s, r) => s + r.netPayout, 0);
  const paidOut = adjustedRows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.netPayout, 0);
  const pending = netPayout - paidOut;
  const pendingCount = adjustedRows.filter((r) => r.status === 'Pending').length;

  function sendAll() {
    const ids = new Set(adjustedRows.filter((r) => r.status === 'Pending').map((r) => r.id));
    setSentIds((prev) => new Set([...prev, ...ids]));
    setToast(`Queued ${ids.size} payout${ids.size === 1 ? '' : 's'} for RTP delivery`);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="px-8 py-6">
      <Link
        href="/payouts"
        className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg mb-3"
      >
        ← Back to All Partners
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
            Partner Payouts
          </p>
          <h1 className="mt-1 text-fg">{p!.name}</h1>
          <p className="mt-2 text-[13px] text-fg-muted">
            ✉ {p!.email} &nbsp; · &nbsp; ☎ {p!.phone} &nbsp; · &nbsp; {p!.industry}
          </p>
        </div>
        <Button size="md" onClick={sendAll} disabled={pendingCount === 0}>
          <SendIcon size={14} />
          {pendingCount === 0 ? 'All payouts sent' : `Send All to Accounts (${pendingCount})`}
        </Button>
      </div>

      <PageBody>
        <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3 mb-5 flex items-start gap-3">
          <InfoIcon size={16} className="text-fg-muted shrink-0 mt-0.5" />
          <p className="text-[13px] text-fg-secondary">
            <span className="font-semibold">Payout Schedule:</span> Payouts are processed twice
            monthly on the <span className="font-semibold">1st</span> and{' '}
            <span className="font-semibold">15th</span>. Next payouts:{' '}
            <span className="font-semibold">May 15, 2026</span> &amp;{' '}
            <span className="font-semibold">Jun 1, 2026</span>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Kpi label="Total Funded" value={fmt(totalFunded)} />
          <Kpi label="Fees (10%)" value={fmt(totalFees)} />
          <Kpi label="Net Payout" value={fmt(netPayout)} />
          <Kpi label="Paid Out" value={fmt(paidOut)} />
          <Kpi label="Pending" value={fmt(pending)} />
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-fg">
                Funded Applications ({adjustedRows.length})
              </h2>
              <span className="text-[12px] font-semibold text-fg-secondary">
                {pendingCount} pending · {fmt(pending)} to pay
              </span>
            </div>
            <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-2">ID</span>
              <span className="col-span-2">Client</span>
              <span className="col-span-1">Product</span>
              <span className="col-span-2 text-right">Loan Amount</span>
              <span className="col-span-1 text-right">Fee</span>
              <span className="col-span-2 text-right">Net Payout</span>
              <span className="col-span-1 text-right">Funded</span>
              <span className="col-span-1">Status</span>
            </div>
            <ul className="divide-y divide-border">
              {adjustedRows.map((r) => (
                <li key={r.id} className="grid grid-cols-12 px-5 py-3 items-center text-[13px]">
                  <span className="col-span-2 font-mono text-fg-secondary">{r.id}</span>
                  <span className="col-span-2 font-medium text-fg truncate">{r.client}</span>
                  <span className="col-span-1 text-fg-secondary text-[12px]">{r.product}</span>
                  <span className="col-span-2 text-right font-semibold text-fg tabular-nums">{fmt(r.loanAmount)}</span>
                  <span className="col-span-1 text-right text-fg-secondary tabular-nums">{fmt(r.fee)}</span>
                  <span className="col-span-2 text-right font-semibold text-fg tabular-nums">{fmt(r.netPayout)}</span>
                  <span className="col-span-1 text-right text-fg-muted">{r.funded}</span>
                  <span className="col-span-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary border border-border">
                      {r.status}
                    </span>
                  </span>
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
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1.5 text-[18px] font-bold tracking-tight text-fg leading-none tabular-nums">{value}</p>
    </div>
  );
}
