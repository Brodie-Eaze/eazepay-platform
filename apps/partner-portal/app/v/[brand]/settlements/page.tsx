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
  DollarIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { useApi, formatCurrency, statusBadge } from '../../../../lib/api-client';
import { partners } from '../../../../lib/master-data';

/**
 * Brand portal — Settlements.
 *
 * Direct port of the Lovable merchant-portal `/settlements` page:
 *   - Full-width table (Batch date | Card | Financed | Txns | Net |
 *     Status), pagination footer
 *   - Lovable's verbose-date format: "Wed, Apr 9, 2026"
 *   - Empty state with wallet icon + helper copy
 *
 * Filtered to merchants whose product brand matches the active brand.
 */

const LIMIT = 20;

type Batch = {
  id: string;
  batchDate: string;
  totalCardAmount: number;
  totalFinancedAmount: number;
  totalTransactions: number;
  netAmount: number;
  status: string;
};

const productLabelForBrand = (b: BrandCode): string[] => {
  if (b === 'medpay') return ['MedPay', 'Multi-brand'];
  if (b === 'tradepay') return ['TradePay', 'Multi-brand'];
  if (b === 'coachpay') return ['CoachPay', 'Multi-brand'];
  return [];
};

const seedBatchesForBrand = (b: BrandCode | null): Batch[] => {
  const labels = b ? productLabelForBrand(b) : [];
  const ps = labels.length === 0 ? partners : partners.filter((p) => labels.includes(p.product));
  return ps.flatMap((p, i) =>
    Array.from({ length: 3 }).map((_, k) => ({
      id: `b_${p.id.slice(2)}_${k}`,
      batchDate: new Date(Date.now() - (i * 3 + k) * 86_400_000).toISOString(),
      totalCardAmount: Math.round(p.netCents * 0.55),
      totalFinancedAmount: Math.round(p.netCents * 0.42),
      totalTransactions: 14 + k * 2 + i,
      netAmount: Math.round(p.netCents * 0.97),
      status: k === 0 ? 'PENDING' : k === 1 ? 'RECONCILING' : 'RECONCILED',
    })),
  );
};

export default function BrandSettlementsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const brandName = brand ? BRANDS[brand].name : brandSlug;
  const { call } = useApi();
  const [page, setPage] = useState(1);

  const params = useMemo(() => `page=${page}&limit=${LIMIT}`, [page]);

  const { data, isLoading } = useQuery<{ settlements: Batch[]; total: number }>({
    queryKey: ['brand', brand, 'settlements', page],
    queryFn: async () => {
      try {
        return await call<{ settlements: Batch[]; total: number }>(`/brand/${brand}/settlements?${params}`);
      } catch {
        const all = seedBatchesForBrand(brand ?? null);
        const start = (page - 1) * LIMIT;
        return { settlements: all.slice(start, start + LIMIT), total: all.length };
      }
    },
  });

  const batches = data?.settlements ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: brandName, href: `/v/${brandSlug}` },
          { label: 'Settlements' },
        ]}
        title="Settlements"
        description={`Daily settlement batches and reconciliation for ${brandName} merchants.`}
      />
      <PageBody>
        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold text-fg-muted uppercase tracking-wider bg-bg-muted border-b border-border rounded-t-xl">
              <span className="col-span-3">Batch date</span>
              <span className="col-span-2 text-right">Card volume</span>
              <span className="col-span-2 text-right">Financed</span>
              <span className="col-span-1 text-right">Txns</span>
              <span className="col-span-2 text-right">Net</span>
              <span className="col-span-2">Status</span>
            </div>

            {isLoading ? (
              <ul className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li key={i} className="grid grid-cols-12 px-5 py-4 gap-3">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className={'h-4 bg-bg-muted rounded animate-pulse ' + (j === 0 ? 'col-span-3' : j === 3 ? 'col-span-1' : 'col-span-2')} />
                    ))}
                  </li>
                ))}
              </ul>
            ) : batches.length === 0 ? (
              <div className="text-center py-12">
                <DollarIcon size={32} className="mx-auto mb-3 text-fg-muted" />
                <p className="font-medium text-fg">No settlement batches yet</p>
                <p className="text-[12px] text-fg-muted mt-1">Settlement batches are generated daily after transactions process.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {batches.map((b) => (
                  <li
                    key={b.id}
                    className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]"
                  >
                    <div className="col-span-3 text-[13px] font-medium text-fg">
                      {new Date(b.batchDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="col-span-2 text-right text-[13px] text-fg tabular-nums">{formatCurrency(b.totalCardAmount)}</div>
                    <div className="col-span-2 text-right text-[13px] text-fg tabular-nums">{formatCurrency(b.totalFinancedAmount)}</div>
                    <div className="col-span-1 text-right text-[13px] text-fg-secondary tabular-nums">{b.totalTransactions}</div>
                    <div className="col-span-2 text-right text-[13px] font-semibold text-fg tabular-nums">{formatCurrency(b.netAmount)}</div>
                    <div className="col-span-2">
                      <span className={'inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ' + statusBadge(b.status)}>
                        {b.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-[11px] text-fg-muted">Page {page} of {pageCount}</p>
                <div className="flex gap-1 items-center">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    ← Prev
                  </Button>
                  <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
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
