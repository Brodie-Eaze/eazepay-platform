'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, PageBody, Card, CardBody, Button, BankIcon, XIcon } from '@eazepay/ui/web';
import { useApi, formatDate, statusBadge } from '../../lib/api-client';
import {
  marketplaceLenders as seedLenders,
  type MarketplaceLenderRow,
} from '../../lib/marketplace-data';

/**
 * Master Command Centre — Lenders.
 *
 * Direct port of the Lovable admin-portal `/lenders` page:
 *   - Inline "Add lender" form opens above the table when toggled
 *   - List of lenders with name + product allowlist subline,
 *     integration type column, inline status select, applications count
 *   - useMutation for both create + status patch with TanStack Query
 *     cache invalidation
 *
 * Data falls back to the local marketplace fixture when the BFF is
 * unwired so the page renders identically in dev.
 */

const BLANK_FORM = {
  name: '',
  integrationType: 'API',
  apiBaseUrl: '',
  products: '',
  minAmount: '',
  maxAmount: '',
  minCreditScore: '',
};

type LenderRow = MarketplaceLenderRow & {
  status?: 'active' | 'inactive' | 'disabled' | 'pending';
  integrationType?: string;
  apiBaseUrl?: string | null;
  applicationsCount?: number;
  name?: string; // legacy alias
  products?: string[];
  createdAt?: string;
  enabled?: boolean;
};

export default function LendersPage() {
  const { call } = useApi();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  const { data, isLoading } = useQuery<LenderRow[]>({
    queryKey: ['admin', 'lenders'],
    queryFn: async () => {
      try {
        return await call<LenderRow[]>('/admin/marketplace-lenders');
      } catch {
        return seedLenders.map((l, i) => ({
          ...l,
          name: l.displayName,
          products: l.brands,
          enabled: l.globallyEnabled,
          createdAt: l.syncedAt,
          status: (l.pendingIntegration ? 'pending' : l.globallyEnabled ? 'active' : 'inactive') as
            | 'active'
            | 'inactive'
            | 'disabled'
            | 'pending',
          integrationType: 'API',
          apiBaseUrl: null,
          applicationsCount: l.pendingIntegration ? 0 : Math.max(0, 24 - i * 3),
        })) as LenderRow[];
      }
    },
  });

  const lenders = data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      call('/admin/marketplace-lenders', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setShowCreate(false);
      setForm({ ...BLANK_FORM });
      qc.invalidateQueries({ queryKey: ['admin', 'lenders'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      call(`/admin/marketplace-lenders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'lenders'] }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      products: form.products
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      minAmount: form.minAmount ? parseInt(form.minAmount, 10) * 100 : undefined,
      maxAmount: form.maxAmount ? parseInt(form.maxAmount, 10) * 100 : undefined,
      minCreditScore: form.minCreditScore ? parseInt(form.minCreditScore, 10) : undefined,
    });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }, { label: 'Lenders' }]}
        title="Lender Panel"
        description="Direct integrations + marketplace adapters. Toggle availability, inspect approval volume."
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Link href="/docs">
              <Button size="sm" variant="ghost">
                API docs
              </Button>
            </Link>
            <Link href="/lenders">
              <Button size="sm" variant="ghost">
                Public hub
              </Button>
            </Link>
            <Link href="/lender-marketplace/access">
              <Button size="sm" variant="secondary">
                Per-partner access
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Cancel' : 'Add lender'}
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 mb-5 flex items-start gap-3">
          <span className="size-4 rounded-full bg-bg-inverse text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
            i
          </span>
          <p className="text-[13px] text-fg-secondary">
            <span className="font-semibold">How these toggles work:</span> When a client opens a
            partner&apos;s apply link (eg.{' '}
            <span className="font-mono">eazemedpay.lovable.app/?ref=&lt;partner&gt;</span>), we run
            HighSale&apos;s soft-pull then show only lenders whose{' '}
            <span className="font-semibold">global enable</span> is on AND who match the
            applicant&apos;s brand + credit tier — minus any per-partner overrides flipped at{' '}
            <a href="/lender-marketplace/access" className="underline font-semibold">
              Per-partner access
            </a>
            .
          </p>
        </div>

        {showCreate && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-fg">New lender</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-fg-muted hover:text-fg"
                  aria-label="Close"
                >
                  <XIcon size={18} />
                </button>
              </div>
              <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Name *
                  </label>
                  <input
                    required
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Integration type
                  </label>
                  <select
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.integrationType}
                    onChange={(e) => setForm((f) => ({ ...f, integrationType: e.target.value }))}
                  >
                    <option>API</option>
                    <option>REDIRECT</option>
                    <option>IFRAME</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    API base URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.lender.example.com"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.apiBaseUrl}
                    onChange={(e) => setForm((f) => ({ ...f, apiBaseUrl: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Products (comma-separated)
                  </label>
                  <input
                    placeholder="med-pay, trade-pay"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.products}
                    onChange={(e) => setForm((f) => ({ ...f, products: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Min amount ($)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.minAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Max amount ($)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.maxAmount}
                    onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Min credit score
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.minCreditScore}
                    onChange={(e) => setForm((f) => ({ ...f, minCreditScore: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" disabled={createMutation.isPending || !form.name}>
                    {createMutation.isPending ? 'Creating…' : 'Create lender'}
                  </Button>
                </div>
                {createMutation.isError && (
                  <p className="col-span-2 text-[11px] text-fg font-semibold">
                    {(createMutation.error as Error)?.message ?? 'Create failed'}
                  </p>
                )}
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold text-fg-muted uppercase tracking-wider bg-bg-muted border-b border-border rounded-t-xl">
              <span className="col-span-4">Lender</span>
              <span className="col-span-2">Integration</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2 text-right">Applications</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            {isLoading ? (
              <ul className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="grid grid-cols-12 px-5 py-4 gap-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-4 bg-bg-muted rounded animate-pulse col-span-2 first:col-span-4"
                      />
                    ))}
                  </li>
                ))}
              </ul>
            ) : lenders.length === 0 ? (
              <div className="text-center py-12">
                <BankIcon size={28} className="mx-auto mb-2 text-fg-muted" />
                <p className="text-fg-muted text-[13px]">No lenders configured.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {lenders.map((l) => {
                  const status =
                    l.status ??
                    (l.pendingIntegration ? 'pending' : l.enabled ? 'active' : 'inactive');
                  const pending = l.pendingIntegration;
                  const badgeClass = pending
                    ? 'bg-bg-muted text-fg-secondary border border-border'
                    : statusBadge(status);
                  const badgeTooltip = pending
                    ? `${pending.note} Edit ${pending.adapterFilePath} to wire credentials.`
                    : undefined;
                  return (
                    <li
                      key={l.id}
                      className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="font-medium text-fg truncate">{l.name}</p>
                        <p className="text-[11px] text-fg-muted truncate">
                          {(l.products ?? []).join(', ') || '—'}
                        </p>
                      </div>
                      <div className="col-span-2 text-[12px] text-fg-secondary">
                        {l.integrationType ?? 'API'}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={
                            'text-[11px] px-2 py-0.5 rounded-full font-medium ' + badgeClass
                          }
                          title={badgeTooltip}
                        >
                          {pending ? 'PENDING INTEGRATION' : status.toUpperCase()}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-[13px] font-semibold text-fg tabular-nums">
                        {l.applicationsCount ?? 0}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <span className="text-[11px] text-fg-muted">
                          {formatDate(l.createdAt ?? new Date().toISOString())}
                        </span>
                        <select
                          className="text-[11px] rounded border border-border bg-bg-elevated px-2 py-1"
                          value={status}
                          onChange={(e) =>
                            statusMutation.mutate({ id: l.id, status: e.target.value })
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
