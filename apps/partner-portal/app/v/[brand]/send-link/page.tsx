'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  CopyIcon,
  CheckIcon,
  LinkIcon,
  XIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { useApi, formatCurrency, formatDate } from '../../../../lib/api-client';

/**
 * Brand portal — Payment Links.
 *
 * Direct port of the Lovable merchant-portal `/payment-links` page:
 *   - "+ New payment link" opens an inline create dialog (description,
 *     amount, customer name + email, expiry days)
 *   - List of links rendered as one row per record with progress dots
 *     showing CREATED → SENT → OPENED → STARTED → COMPLETED
 *   - Copy URL button per row (constant-time feedback)
 *   - Inline "Disable" / "Resend" mutations
 *
 * The full activity-timeline drawer + refund flow lands in a follow-on
 * round; this turn ships list + create + disable + copy. Mutations
 * talk to the BFF, with cache invalidation via TanStack Query.
 */

const LINK_URL_BASE = 'pay.eazepay.com/p/';

type PaymentLink = {
  id: string;
  token: string;
  description: string;
  amount: number; // cents
  customerName: string | null;
  customerEmail: string | null;
  status: 'CREATED' | 'SENT' | 'OPENED' | 'STARTED' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED' | 'DISABLED';
  createdAt: string;
  expiresAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
  disabledAt: string | null;
};

const STATUS_LABEL: Record<PaymentLink['status'], string> = {
  CREATED: 'Not sent',
  SENT: 'Sent',
  OPENED: 'Opened',
  STARTED: 'In checkout',
  COMPLETED: 'Paid',
  ABANDONED: 'Abandoned',
  EXPIRED: 'Expired',
  DISABLED: 'Disabled',
};

const PROGRESS_STEPS: Array<PaymentLink['status']> = ['CREATED', 'SENT', 'OPENED', 'STARTED', 'COMPLETED'];
const TERMINAL = new Set<PaymentLink['status']>(['ABANDONED', 'EXPIRED', 'DISABLED', 'COMPLETED']);

function ProgressDots({ status }: { status: PaymentLink['status'] }) {
  if (TERMINAL.has(status) && status !== 'COMPLETED') {
    return (
      <span className={'text-[10px] font-semibold ' + (status === 'EXPIRED' ? 'text-fg-muted' : 'text-fg')}>
        {STATUS_LABEL[status]}
      </span>
    );
  }
  const idx = PROGRESS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-[3px]" aria-label={STATUS_LABEL[status]}>
      {PROGRESS_STEPS.map((s, i) => (
        <span
          key={s}
          className={
            'h-[5px] rounded-full transition-all ' +
            (i === 0 || i === PROGRESS_STEPS.length - 1 ? 'w-[10px] ' : 'w-[14px] ') +
            (i <= idx ? 'bg-accent' : 'bg-border')
          }
        />
      ))}
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
      className={
        'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all border ' +
        (ok
          ? 'text-white bg-bg-inverse border-bg-inverse'
          : 'text-fg-secondary hover:text-fg bg-bg-elevated hover:bg-bg-muted border-border')
      }
    >
      {ok ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}

const seedLinks = (brand: BrandCode | undefined): PaymentLink[] => {
  const now = Date.now();
  return [
    {
      id: 'pl_001',
      token: 'A4F7K9LMN2QPRSTV',
      description: `${brand ? BRANDS[brand].name : 'EAZE'} consultation`,
      amount: 49_900,
      customerName: 'Cassidy Wren',
      customerEmail: 'cassidy.w@inbox.test',
      status: 'OPENED',
      createdAt: new Date(now - 1_800_000).toISOString(),
      expiresAt: new Date(now + 86_400_000 * 7).toISOString(),
      sentAt: new Date(now - 1_600_000).toISOString(),
      openedAt: new Date(now - 1_200_000).toISOString(),
      startedAt: null,
      completedAt: null,
      abandonedAt: null,
      disabledAt: null,
    },
    {
      id: 'pl_002',
      token: 'XYZ123ABCDEFGHJK',
      description: 'Procedure deposit',
      amount: 175_000,
      customerName: 'Tomas Ibarra',
      customerEmail: 'tomas.i@inbox.test',
      status: 'COMPLETED',
      createdAt: new Date(now - 86_400_000).toISOString(),
      expiresAt: new Date(now + 86_400_000 * 14).toISOString(),
      sentAt: new Date(now - 86_300_000).toISOString(),
      openedAt: new Date(now - 86_000_000).toISOString(),
      startedAt: new Date(now - 85_500_000).toISOString(),
      completedAt: new Date(now - 85_000_000).toISOString(),
      abandonedAt: null,
      disabledAt: null,
    },
    {
      id: 'pl_003',
      token: 'BMNOPQRSTUVWXYZA',
      description: 'Recovery package — final balance',
      amount: 250_000,
      customerName: 'Priya Anand',
      customerEmail: 'priya.a@inbox.test',
      status: 'EXPIRED',
      createdAt: new Date(now - 86_400_000 * 14).toISOString(),
      expiresAt: new Date(now - 86_400_000).toISOString(),
      sentAt: new Date(now - 86_400_000 * 14 + 100_000).toISOString(),
      openedAt: null,
      startedAt: null,
      completedAt: null,
      abandonedAt: null,
      disabledAt: null,
    },
  ];
};

interface CreateForm {
  description: string;
  amount: string;
  customerName: string;
  customerEmail: string;
  expiresInDays: string;
}
const BLANK_FORM: CreateForm = { description: '', amount: '', customerName: '', customerEmail: '', expiresInDays: '14' };

export default function PaymentLinksPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const brandName = brand ? BRANDS[brand].name : brandSlug;

  const { call } = useApi();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ ...BLANK_FORM });

  const { data, isLoading } = useQuery<{ links: PaymentLink[]; total: number }>({
    queryKey: ['brand', brand, 'payment-links'],
    queryFn: async () => {
      try {
        return await call(`/brand/${brand}/payment-links`);
      } catch {
        const links = seedLinks(brand);
        return { links, total: links.length };
      }
    },
  });

  const links = data?.links ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      call(`/brand/${brand}/payment-links`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setShowCreate(false);
      setForm({ ...BLANK_FORM });
      qc.invalidateQueries({ queryKey: ['brand', brand, 'payment-links'] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (id: string) =>
      call(`/brand/${brand}/payment-links/${id}/disable`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', brand, 'payment-links'] }),
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) =>
      call(`/brand/${brand}/payment-links/${id}/resend`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', brand, 'payment-links'] }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(form.amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    createMutation.mutate({
      description: form.description,
      amount: cents,
      customerName: form.customerName || null,
      customerEmail: form.customerEmail || null,
      expiresInDays: form.expiresInDays ? parseInt(form.expiresInDays, 10) : 14,
    });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: brandName, href: `/v/${brandSlug}` },
          { label: 'Payment Links' },
        ]}
        title="Payment Links"
        description={`Send a payment or financing link to a customer — ${brandName} branded checkout.`}
        actions={
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : '+ New payment link'}
          </Button>
        }
      />
      <PageBody>
        {showCreate && (
          <Card className="mb-4">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-fg">New payment link</h2>
                <button onClick={() => setShowCreate(false)} className="text-fg-muted hover:text-fg" aria-label="Close">
                  <XIcon size={16} />
                </button>
              </div>
              <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">Description *</label>
                  <input
                    required
                    placeholder="What is this payment for?"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">Amount (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] tabular-nums"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">Expires in (days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.expiresInDays}
                    onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">Customer name</label>
                  <input
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">Customer email</label>
                  <input
                    type="email"
                    placeholder="If set, link is emailed automatically"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" disabled={createMutation.isPending || !form.description || !form.amount}>
                    {createMutation.isPending ? 'Creating…' : 'Create link'}
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
              <span className="col-span-4">Description · Customer</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-3">Progress</span>
              <span className="col-span-3 text-right">Actions</span>
            </div>

            {isLoading ? (
              <ul className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="grid grid-cols-12 px-5 py-4 gap-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className={'h-4 bg-bg-muted rounded animate-pulse ' + (j === 0 ? 'col-span-4' : 'col-span-2')} />
                    ))}
                  </li>
                ))}
              </ul>
            ) : links.length === 0 ? (
              <div className="text-center py-12">
                <LinkIcon size={32} className="mx-auto mb-3 text-fg-muted" />
                <p className="font-medium text-fg">No payment links yet</p>
                <p className="text-[12px] text-fg-muted mt-1">Create your first link to start collecting payments.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {links.map((l) => {
                  const url = `https://${LINK_URL_BASE}${l.token}`;
                  const canDisable = !TERMINAL.has(l.status);
                  const canResend = ['SENT', 'OPENED', 'STARTED', 'ABANDONED'].includes(l.status);
                  return (
                    <li key={l.id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]">
                      <div className="col-span-4 min-w-0">
                        <p className="font-medium text-fg truncate">{l.description}</p>
                        <p className="text-[11px] text-fg-muted truncate">
                          {l.customerName ?? '—'}
                          {l.customerEmail ? ` · ${l.customerEmail}` : ''}
                        </p>
                        <p className="text-[10px] font-mono text-fg-muted truncate mt-0.5">
                          {LINK_URL_BASE}
                          {l.token}
                        </p>
                      </div>
                      <div className="col-span-2 text-right text-[13px] font-semibold text-fg tabular-nums">
                        {formatCurrency(l.amount)}
                      </div>
                      <div className="col-span-3 flex flex-col gap-1">
                        <ProgressDots status={l.status} />
                        <span className="text-[11px] text-fg-muted">
                          {STATUS_LABEL[l.status]} · {timeAgo(l.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <CopyBtn text={url} />
                        {canResend && (
                          <Button size="sm" variant="ghost" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(l.id)}>
                            Resend
                          </Button>
                        )}
                        {canDisable && (
                          <Button size="sm" variant="ghost" disabled={disableMutation.isPending} onClick={() => disableMutation.mutate(l.id)}>
                            Disable
                          </Button>
                        )}
                        {l.status === 'COMPLETED' && (
                          <StatusPill tone="success" dot>
                            Paid
                          </StatusPill>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-[11px] text-fg-muted">
                {total} link{total === 1 ? '' : 's'} total
              </p>
              <p className="text-[11px] text-fg-muted">Activity timeline + refund flow coming next round.</p>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
