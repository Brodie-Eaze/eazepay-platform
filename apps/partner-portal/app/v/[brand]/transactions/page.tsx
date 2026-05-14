'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  QueueIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { useApi, formatCurrency, formatDate, statusBadge } from '../../../../lib/api-client';
import { applications } from '../../../../lib/master-data';

/**
 * Brand portal — Transactions.
 *
 * Direct port of the Lovable merchant-portal `/transactions` page:
 *   - Segmented status filter (All | Captured | Settled | Declined |
 *     Refunded | Voided) using the same indigo-active treatment
 *   - Paginated table (20/page) with formatCurrency + statusBadge
 *   - Reference column rendered in mono
 *
 * Falls back to brand-filtered fixture so the surface is interactive
 * in dev.
 */

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Captured', value: 'CAPTURED' },
  { label: 'Settled', value: 'SETTLED' },
  { label: 'Declined', value: 'DECLINED' },
  { label: 'Refunded', value: 'REFUNDED' },
  { label: 'Voided', value: 'VOIDED' },
] as const;

const LIMIT = 20;

type Txn = {
  id: string;
  referenceNumber: string;
  customerName: string;
  customerEmail: string;
  type: 'SALE' | 'FINANCING' | 'REFUND';
  amount: number;
  status: string;
  createdAt: string;
};

const productCodeForBrand = (b: BrandCode): 'med-pay' | 'trade-pay' | 'coach-pay' | null => {
  if (b === 'medpay') return 'med-pay';
  if (b === 'tradepay') return 'trade-pay';
  if (b === 'coachpay') return 'coach-pay';
  return null;
};

const seedTxnsForBrand = (b: BrandCode | null): Txn[] => {
  const pc = b ? productCodeForBrand(b) : null;
  return applications
    .filter((a) => (pc ? a.product === pc : true))
    .map((a, i) => ({
      id: a.id,
      referenceNumber: `TXN-${a.id.replace(/_/g, '').toUpperCase()}`,
      customerName: a.customer,
      customerEmail: a.customerEmail,
      type: a.status === 'funded' ? 'FINANCING' : 'SALE',
      amount: a.amountCents,
      status:
        a.status === 'funded'
          ? 'SETTLED'
          : a.status === 'declined'
            ? 'DECLINED'
            : a.status === 'approved'
              ? 'CAPTURED'
              : 'CAPTURED',
      createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
};

export default function BrandTransactionsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const brandName = brand ? BRANDS[brand].name : brandSlug;
  const { call } = useApi();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status) p.set('status', status);
    return p.toString();
  }, [page, status]);

  const { data, isLoading } = useQuery<{ transactions: Txn[]; total: number }>({
    queryKey: ['brand', brand, 'transactions', status, page],
    queryFn: async () => {
      try {
        return await call<{ transactions: Txn[]; total: number }>(`/brand/${brand}/transactions?${params}`);
      } catch {
        const seed = seedTxnsForBrand(brand ?? null);
        const filtered = status ? seed.filter((t) => t.status === status) : seed;
        const start = (page - 1) * LIMIT;
        return { transactions: filtered.slice(start, start + LIMIT), total: filtered.length };
      }
    },
  });

  const txns = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: brandName, href: `/v/${brandSlug}` },
          { label: 'Transactions' },
        ]}
        title="Transactions"
        description={`All card and financed payments for ${brandName}.`}
      />
      <PageBody>
        {/* Segmented filter — matches Lovable's chip bar */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-border rounded-lg p-1 w-fit mb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
              className={
                'px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ' +
                (status === opt.value
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-fg-muted hover:text-fg')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold text-fg-muted uppercase tracking-wider bg-bg-muted border-b border-border rounded-t-xl">
              <span className="col-span-2">Reference</span>
              <span className="col-span-3">Customer</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>

            {isLoading ? (
              <ul className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i} className="grid grid-cols-12 px-5 py-4 gap-3">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className={'h-4 bg-bg-muted rounded animate-pulse ' + (j === 1 ? 'col-span-3' : 'col-span-2')} />
                    ))}
                  </li>
                ))}
              </ul>
            ) : txns.length === 0 ? (
              <div className="text-center py-12">
                <QueueIcon size={28} className="mx-auto mb-2 text-fg-muted" />
                <p className="text-fg-muted text-[13px]">No transactions found.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {txns.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]"
                  >
                    <div className="col-span-2 font-mono text-[11px] text-fg-muted truncate">{t.referenceNumber}</div>
                    <div className="col-span-3 min-w-0">
                      <p className="font-medium text-fg truncate">{t.customerName || '—'}</p>
                      {t.customerEmail && <p className="text-[11px] text-fg-muted truncate">{t.customerEmail}</p>}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={
                          'text-[11px] font-medium px-2 py-0.5 rounded-md ' +
                          (t.type === 'FINANCING'
                            ? 'text-violet-700 bg-violet-50'
                            : 'text-fg-secondary bg-bg-muted')
                        }
                      >
                        {t.type === 'SALE' ? 'card' : t.type.toLowerCase()}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-[13px] font-semibold text-fg tabular-nums">
                      {formatCurrency(t.amount)}
                    </div>
                    <div className="col-span-2">
                      <span className={'text-[11px] px-2 py-0.5 rounded-full font-medium ' + statusBadge(t.status)}>
                        {t.status}
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-[11px] text-fg-muted">{formatDate(t.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-[11px] text-fg-muted">{total} transactions total</p>
                <div className="flex gap-1 items-center">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Prev
                  </Button>
                  <span className="px-3 py-1 text-[12px] text-fg-secondary tabular-nums">
                    {page} / {pageCount}
                  </span>
                  <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
