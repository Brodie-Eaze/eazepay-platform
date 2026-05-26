'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusPill,
  type StatusTone,
  CopyIcon,
  CheckIcon,
  LinkIcon,
  XIcon,
  SendIcon,
  PhoneIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { formatTime } from '@eazepay/shared-utils/format-time';
import { useApi } from '../../../../lib/api-client';
import { csrfHeaders } from '../../../../lib/client-csrf';

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
  status:
    | 'CREATED'
    | 'SENT'
    | 'OPENED'
    | 'STARTED'
    | 'COMPLETED'
    | 'ABANDONED'
    | 'EXPIRED'
    | 'DISABLED';
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

const PROGRESS_STEPS: Array<PaymentLink['status']> = [
  'CREATED',
  'SENT',
  'OPENED',
  'STARTED',
  'COMPLETED',
];
const TERMINAL = new Set<PaymentLink['status']>(['ABANDONED', 'EXPIRED', 'DISABLED', 'COMPLETED']);

function ProgressDots({ status }: { status: PaymentLink['status'] }) {
  if (TERMINAL.has(status) && status !== 'COMPLETED') {
    return (
      <span
        className={
          'text-[10px] font-semibold ' + (status === 'EXPIRED' ? 'text-fg-muted' : 'text-fg')
        }
      >
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
  return formatTime(iso, { mode: 'date' });
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
const BLANK_FORM: CreateForm = {
  description: '',
  amount: '',
  customerName: '',
  customerEmail: '',
  expiresInDays: '14',
};

/* ────────────────────────────────────────────────────────────────────
 * Consumer financing-link panel
 *
 * Adds the partner-side equivalent of the master operator's
 * `/onboarding-pipeline` invite mint flow — but for CONSUMERS, not
 * businesses. A salesperson at this partner mints a per-consumer link,
 * sends it via SMS / email, then watches the live tracker.
 *
 * Until Clerk auth lands, we identify the salesperson with a hard-coded
 * demo email and pick a representative partner id per brand so the
 * invite store has somewhere to bucket records by `partnerId`.
 * ──────────────────────────────────────────────────────────────────── */

type ConsumerInviteBrand = 'medpay' | 'tradepay' | 'coachpay';

interface ConsumerInviteForm {
  consumerFirstName: string;
  consumerLastName: string;
  consumerEmail: string;
  consumerPhone: string;
  loanAmount: string; // dollars, optional
  purpose: string;
  expiryHours: '1' | '24' | '168' | '720';
  salespersonEmail: string;
}

const BLANK_CONSUMER_FORM: ConsumerInviteForm = {
  consumerFirstName: '',
  consumerLastName: '',
  consumerEmail: '',
  consumerPhone: '',
  loanAmount: '',
  purpose: '',
  expiryHours: '168',
  salespersonEmail: '',
};

interface ConsumerInviteRow {
  token: string;
  partnerId: string;
  brand: ConsumerInviteBrand;
  salespersonEmail: string;
  consumerFirstName?: string;
  consumerLastName?: string;
  consumerEmail?: string;
  consumerPhone?: string;
  loanAmountCents?: number;
  purpose?: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'in_progress' | 'redeemed';
  applicationId: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  inviteUrl: string;
}

type LiveStatus =
  | 'invite_sent'
  | 'form_started'
  | 'consent_captured'
  | 'soft_pull_initiated'
  | 'soft_pull_returned'
  | 'orchestration_running'
  | 'offers_available'
  | 'offer_accepted'
  | 'contract_signed'
  | 'funded';

const LIVE_STATUS_TONE: Record<LiveStatus | 'invite_sent', StatusTone> = {
  invite_sent: 'neutral',
  form_started: 'info',
  consent_captured: 'info',
  soft_pull_initiated: 'warning',
  soft_pull_returned: 'warning',
  orchestration_running: 'warning',
  offers_available: 'success',
  offer_accepted: 'success',
  contract_signed: 'success',
  funded: 'success',
};

const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  invite_sent: 'Invite sent',
  form_started: 'Form started',
  consent_captured: 'Consent captured',
  soft_pull_initiated: 'Soft pull',
  soft_pull_returned: 'Soft pull back',
  orchestration_running: 'Routing',
  offers_available: 'Offers ready',
  offer_accepted: 'Offer accepted',
  contract_signed: 'Contract signed',
  funded: 'Funded',
};

/* Per-brand partner picker — until real auth wires in, we map a brand
 * to one representative partner id so every mint is anchored to a
 * partner record. */
const PARTNER_FOR_BRAND: Record<ConsumerInviteBrand, string> = {
  medpay: 'p_helio',
  tradepay: 'p_orion',
  coachpay: 'p_atlas',
};

/* Brand label kept local to avoid pulling the server-only store
 * (`consumer-invites-store.ts` imports `node:fs`) into the client bundle. */
const CONSUMER_BRAND_LABEL: Record<ConsumerInviteBrand, string> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

/* Demo salesperson — overridable in the "send on behalf of" field. */
const DEMO_SALESPERSON_EMAIL = 'sales@partner.test';

const EXPIRY_LABELS: Record<ConsumerInviteForm['expiryHours'], string> = {
  '1': '1 hour',
  '24': '24 hours',
  '168': '7 days',
  '720': '30 days',
};

function relativeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PaymentLinksPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const brandName = brand ? BRANDS[brand].name : brandSlug;

  const { call } = useApi();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ ...BLANK_FORM });

  /* ── Consumer financing-link state ───────────────────────────────── */
  const consumerBrand = (
    brand === 'medpay' || brand === 'tradepay' || brand === 'coachpay' ? brand : null
  ) as ConsumerInviteBrand | null;
  const partnerId = consumerBrand ? PARTNER_FOR_BRAND[consumerBrand] : '';

  const [consumerForm, setConsumerForm] = useState<ConsumerInviteForm>({
    ...BLANK_CONSUMER_FORM,
    salespersonEmail: DEMO_SALESPERSON_EMAIL,
  });
  const [consumerError, setConsumerError] = useState<string | null>(null);
  const [consumerSubmitting, setConsumerSubmitting] = useState(false);
  const [lastMintedInvite, setLastMintedInvite] = useState<ConsumerInviteRow | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  /* My-recent-invites — pulled live from the BFF, filtered to the
   * current salesperson (matching how the operator's "Your invites"
   * filter works in /onboarding-pipeline). */
  const recentInvitesQuery = useQuery<{ invites: ConsumerInviteRow[] }>({
    queryKey: ['consumer-invites', consumerBrand, consumerForm.salespersonEmail],
    enabled: !!consumerBrand && !!consumerForm.salespersonEmail,
    queryFn: async () => {
      const res = await fetch(
        `/api/v/${consumerBrand}/consumer-invites?salespersonEmail=${encodeURIComponent(consumerForm.salespersonEmail)}`,
        { credentials: 'include' },
      );
      if (!res.ok) return { invites: [] };
      return (await res.json()) as { invites: ConsumerInviteRow[] };
    },
    /* Refetch every 10s so the table updates when invites move from
     * `active` → `in_progress` → `redeemed`. */
    refetchInterval: 10_000,
  });

  const consumerInvites = recentInvitesQuery.data?.invites ?? [];

  /* Live-status lookup per applicationId — only for invites that have
   * progressed past `active`. Polls once per query at 5s so the table
   * column shows fresh status pills. */
  const [statusByAppId, setStatusByAppId] = useState<
    Record<string, { status: LiveStatus; lastUpdatedAt: string }>
  >({});
  useEffect(() => {
    if (!consumerBrand) return;
    const apps = consumerInvites
      .filter((i) => i.applicationId && i.status !== 'redeemed')
      .map((i) => i.applicationId as string);
    if (apps.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const updates: Record<string, { status: LiveStatus; lastUpdatedAt: string }> = {};
      await Promise.all(
        apps.map(async (id) => {
          try {
            const res = await fetch(
              `/api/v/${consumerBrand}/applications/${encodeURIComponent(id)}/status`,
              { credentials: 'include' },
            );
            if (!res.ok) return;
            const body = (await res.json()) as { status: LiveStatus; lastUpdatedAt: string };
            updates[id] = { status: body.status, lastUpdatedAt: body.lastUpdatedAt };
          } catch {
            /* Silent — table just won't update this cycle. */
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length) {
        setStatusByAppId((prev) => ({ ...prev, ...updates }));
      }
    };
    void tick();
    const interval = window.setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [consumerBrand, consumerInvites]);

  const submitConsumerInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumerBrand || !partnerId) {
      setConsumerError('This brand cannot mint a consumer financing link.');
      return;
    }
    setConsumerError(null);
    setConsumerSubmitting(true);
    try {
      const amount = parseFloat(consumerForm.loanAmount.replace(/[^0-9.]/g, ''));
      const body: Record<string, unknown> = {
        partnerId,
        salespersonEmail: consumerForm.salespersonEmail,
        consumer: {
          firstName: consumerForm.consumerFirstName || undefined,
          lastName: consumerForm.consumerLastName || undefined,
          email: consumerForm.consumerEmail || undefined,
          phone: consumerForm.consumerPhone || undefined,
        },
        purpose: consumerForm.purpose || undefined,
        expiryHours: parseInt(consumerForm.expiryHours, 10),
      };
      if (Number.isFinite(amount) && amount > 0) {
        body['loanAmountCents'] = Math.round(amount * 100);
      }
      const res = await fetch(`/api/v/${consumerBrand}/consumer-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { detail?: string };
        setConsumerError(
          errBody?.detail ?? 'Could not mint financing link. Check the fields and try again.',
        );
        return;
      }
      const json = (await res.json()) as { token: string; inviteUrl: string; expiresAt: string };
      setLastMintedInvite({
        token: json.token,
        partnerId,
        brand: consumerBrand,
        salespersonEmail: consumerForm.salespersonEmail,
        consumerFirstName: consumerForm.consumerFirstName || undefined,
        consumerLastName: consumerForm.consumerLastName || undefined,
        consumerEmail: consumerForm.consumerEmail || undefined,
        consumerPhone: consumerForm.consumerPhone || undefined,
        loanAmountCents:
          Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : undefined,
        purpose: consumerForm.purpose || undefined,
        expiresAt: json.expiresAt,
        status: 'active',
        applicationId: null,
        createdAt: new Date().toISOString(),
        lastSeenAt: null,
        inviteUrl: json.inviteUrl,
      });
      setConsumerForm({ ...BLANK_CONSUMER_FORM, salespersonEmail: consumerForm.salespersonEmail });
      qc.invalidateQueries({ queryKey: ['consumer-invites', consumerBrand] });
    } catch {
      setConsumerError('Network error. Try again.');
    } finally {
      setConsumerSubmitting(false);
    }
  };

  const copyInviteLink = (token: string, relativeUrl: string) => {
    /* In production the consumer apply lives on the same origin, so a
     * relative URL is enough. We resolve it to an absolute string so
     * the clipboard payload is unambiguous when pasted into SMS. */
    const fullUrl =
      typeof window !== 'undefined'
        ? new URL(relativeUrl, window.location.origin).toString()
        : relativeUrl;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopiedToken(token);
    setTimeout(() => setCopiedToken((curr) => (curr === token ? null : curr)), 1500);
  };

  const buildMailto = (invite: ConsumerInviteRow): string => {
    const fullUrl =
      typeof window !== 'undefined'
        ? new URL(invite.inviteUrl, window.location.origin).toString()
        : invite.inviteUrl;
    const subject = encodeURIComponent(`Your ${CONSUMER_BRAND_LABEL[invite.brand]} financing link`);
    const greeting = invite.consumerFirstName ? `Hi ${invite.consumerFirstName},` : 'Hi,';
    const bodyLines = [
      greeting,
      '',
      `Here is your secure ${CONSUMER_BRAND_LABEL[invite.brand]} financing link. It takes about 2 minutes and a soft check that does not affect your credit score.`,
      '',
      fullUrl,
      '',
      'Reach out if you have any questions.',
    ];
    return `mailto:${invite.consumerEmail ?? ''}?subject=${subject}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
  };

  const buildSmsHref = (invite: ConsumerInviteRow): string => {
    const fullUrl =
      typeof window !== 'undefined'
        ? new URL(invite.inviteUrl, window.location.origin).toString()
        : invite.inviteUrl;
    const greeting = invite.consumerFirstName ? `Hi ${invite.consumerFirstName}, ` : '';
    const messageBody = `${greeting}your ${CONSUMER_BRAND_LABEL[invite.brand]} financing link is ready. Soft check only, about 2 minutes: ${fullUrl}`;
    /* iOS uses `&`; Android tolerates both. Stick with `&` which is the
     * RFC 5724 separator. */
    const phoneTarget = invite.consumerPhone ?? '';
    return `sms:${phoneTarget}&body=${encodeURIComponent(messageBody)}`;
  };

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
        breadcrumbs={[{ label: brandName, href: `/v/${brandSlug}` }, { label: 'Payment Links' }]}
        title="Payment Links"
        description={`Send a payment or financing link to a customer — ${brandName} branded checkout.`}
        actions={
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : '+ New payment link'}
          </Button>
        }
      />
      <PageBody>
        {/* ─── Consumer financing-link panel ───────────────────────── */}
        {consumerBrand && (
          <>
            <Card className="mb-4">
              <CardHeader
                title={`Send consumer financing link`}
                description={`Generate a per-consumer ${CONSUMER_BRAND_LABEL[consumerBrand]} link, send via SMS or email, then watch the application live.`}
                action={
                  <StatusPill tone="accent" dot>
                    {CONSUMER_BRAND_LABEL[consumerBrand]}
                  </StatusPill>
                }
              />
              <CardBody>
                <form
                  onSubmit={submitConsumerInvite}
                  className="grid grid-cols-1 md:grid-cols-6 gap-3"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Consumer first name
                    </label>
                    <input
                      placeholder="e.g. Cassidy"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.consumerFirstName}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, consumerFirstName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Consumer last name
                    </label>
                    <input
                      placeholder="e.g. Wren"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.consumerLastName}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, consumerLastName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Loan amount (USD, optional)
                    </label>
                    <input
                      type="number"
                      step="100"
                      placeholder="e.g. 7400"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] tabular-nums"
                      value={consumerForm.loanAmount}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, loanAmount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Consumer email (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="cassidy@example.com"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.consumerEmail}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, consumerEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Consumer phone (optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="(415) 555 0188"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] tabular-nums"
                      value={consumerForm.consumerPhone}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, consumerPhone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Purpose (optional)
                    </label>
                    <input
                      placeholder={
                        consumerBrand === 'medpay'
                          ? 'e.g. Veneers + cleaning'
                          : consumerBrand === 'tradepay'
                            ? 'e.g. Roof + gutter replacement'
                            : 'e.g. Executive coaching cohort 14'
                      }
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.purpose}
                      onChange={(e) => setConsumerForm((f) => ({ ...f, purpose: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Link expires in
                    </label>
                    <select
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.expiryHours}
                      onChange={(e) =>
                        setConsumerForm((f) => ({
                          ...f,
                          expiryHours: e.target.value as ConsumerInviteForm['expiryHours'],
                        }))
                      }
                    >
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Salesperson (signed-in)
                    </label>
                    <input
                      type="email"
                      placeholder="you@partner.com"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      value={consumerForm.salespersonEmail}
                      onChange={(e) =>
                        setConsumerForm((f) => ({ ...f, salespersonEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                      Send on behalf of (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="teammate@partner.com"
                      className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                      onChange={(e) =>
                        e.target.value &&
                        setConsumerForm((f) => ({ ...f, salespersonEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-6 flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-[11px] text-fg-muted">
                      Anchored to partner <span className="font-mono">{partnerId}</span> · expires
                      in {EXPIRY_LABELS[consumerForm.expiryHours]}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setConsumerForm({
                            ...BLANK_CONSUMER_FORM,
                            salespersonEmail: consumerForm.salespersonEmail,
                          })
                        }
                      >
                        Clear form
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        loading={consumerSubmitting}
                        disabled={consumerSubmitting || !consumerForm.salespersonEmail}
                        leadingIcon={<LinkIcon size={12} />}
                      >
                        Mint financing link
                      </Button>
                    </div>
                  </div>
                  {consumerError && (
                    <p className="md:col-span-6 text-[11px] text-danger font-medium">
                      {consumerError}
                    </p>
                  )}
                </form>

                {/* Last minted invite — copyable + delivery shortcuts */}
                {lastMintedInvite && (
                  <div
                    className="mt-4 rounded-md border border-success/30 bg-success-bg/40 px-4 py-3"
                    role="status"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-success">
                          <CheckIcon size={12} /> Link ready
                        </div>
                        <div className="mt-1 text-[12px] text-fg-secondary">
                          For{' '}
                          <strong className="text-fg">
                            {lastMintedInvite.consumerFirstName ?? 'consumer'}
                            {lastMintedInvite.consumerLastName
                              ? ` ${lastMintedInvite.consumerLastName}`
                              : ''}
                          </strong>
                          {' · expires '}
                          {formatTime(lastMintedInvite.expiresAt, { mode: 'datetime' })}
                        </div>
                        <div className="mt-2 font-mono text-[11px] text-fg-muted break-all">
                          {lastMintedInvite.inviteUrl}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={
                            copiedToken === lastMintedInvite.token ? (
                              <CheckIcon size={12} />
                            ) : (
                              <CopyIcon size={12} />
                            )
                          }
                          onClick={() =>
                            copyInviteLink(lastMintedInvite.token, lastMintedInvite.inviteUrl)
                          }
                        >
                          {copiedToken === lastMintedInvite.token ? 'Copied' : 'Copy URL'}
                        </Button>
                        <a href={buildMailto(lastMintedInvite)}>
                          <Button
                            size="sm"
                            variant="secondary"
                            leadingIcon={<SendIcon size={12} />}
                            type="button"
                          >
                            Email
                          </Button>
                        </a>
                        <a href={buildSmsHref(lastMintedInvite)}>
                          <Button
                            size="sm"
                            variant="secondary"
                            leadingIcon={<PhoneIcon size={12} />}
                            type="button"
                          >
                            SMS
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Recent invites table */}
            <Card className="mb-4">
              <CardHeader
                title="Recent invites you have sent"
                description="Watch each consumer move through the apply flow. Click into a row for the live tracker."
                action={<StatusPill tone="neutral">{consumerInvites.length} total</StatusPill>}
              />
              <CardBody padded={false}>
                <div className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold text-fg-muted uppercase tracking-wider bg-bg-muted border-b border-border">
                  <span className="col-span-3">Consumer</span>
                  <span className="col-span-2">Sent</span>
                  <span className="col-span-3">Status</span>
                  <span className="col-span-2">Last activity</span>
                  <span className="col-span-2 text-right">Actions</span>
                </div>
                {consumerInvites.length === 0 ? (
                  <div className="text-center py-10">
                    <LinkIcon size={28} className="mx-auto mb-3 text-fg-muted" />
                    <p className="font-medium text-fg text-[13px]">No financing links sent yet</p>
                    <p className="text-[12px] text-fg-muted mt-1">
                      Mint your first link above and a row will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {consumerInvites.map((inv) => {
                      const liveStatus =
                        (inv.applicationId && statusByAppId[inv.applicationId]?.status) ||
                        (inv.status === 'redeemed'
                          ? ('funded' as LiveStatus)
                          : ('invite_sent' as LiveStatus));
                      const tone = LIVE_STATUS_TONE[liveStatus];
                      const fullName =
                        [inv.consumerFirstName, inv.consumerLastName].filter(Boolean).join(' ') ||
                        'Unknown consumer';
                      return (
                        <li
                          key={inv.token}
                          className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]"
                        >
                          <div className="col-span-3 min-w-0">
                            <p className="font-medium text-fg truncate">{fullName}</p>
                            <p className="text-[11px] text-fg-muted truncate">
                              {inv.consumerEmail ?? inv.consumerPhone ?? '—'}
                            </p>
                          </div>
                          <div className="col-span-2 text-[12px] text-fg-secondary">
                            {relativeAgo(inv.createdAt)}
                          </div>
                          <div className="col-span-3 flex items-center gap-2">
                            <span
                              className="size-1.5 rounded-full bg-info animate-pulse"
                              aria-hidden
                            />
                            <StatusPill tone={tone}>{LIVE_STATUS_LABEL[liveStatus]}</StatusPill>
                          </div>
                          <div className="col-span-2 text-[11px] text-fg-muted">
                            {inv.lastSeenAt ? relativeAgo(inv.lastSeenAt) : 'no activity yet'}
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={
                                copiedToken === inv.token ? (
                                  <CheckIcon size={12} />
                                ) : (
                                  <CopyIcon size={12} />
                                )
                              }
                              onClick={() => copyInviteLink(inv.token, inv.inviteUrl)}
                            >
                              {copiedToken === inv.token ? 'Copied' : 'Copy'}
                            </Button>
                            {inv.applicationId ? (
                              <Link href={`/v/${brandSlug}/applications/${inv.applicationId}`}>
                                <Button size="sm" variant="secondary">
                                  View live
                                </Button>
                              </Link>
                            ) : (
                              <Button size="sm" variant="ghost" disabled>
                                Awaiting
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          </>
        )}

        {showCreate && (
          <Card className="mb-4">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-fg">New payment link</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-fg-muted hover:text-fg"
                  aria-label="Close"
                >
                  <XIcon size={16} />
                </button>
              </div>
              <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Description *
                  </label>
                  <input
                    required
                    placeholder="What is this payment for?"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Amount (USD) *
                  </label>
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
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Expires in (days)
                  </label>
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
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Customer name
                  </label>
                  <input
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                    Customer email
                  </label>
                  <input
                    type="email"
                    placeholder="If set, link is emailed automatically"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
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
                  <Button
                    size="sm"
                    type="submit"
                    disabled={createMutation.isPending || !form.description || !form.amount}
                  >
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
                      <div
                        key={j}
                        className={
                          'h-4 bg-bg-muted rounded animate-pulse ' +
                          (j === 0 ? 'col-span-4' : 'col-span-2')
                        }
                      />
                    ))}
                  </li>
                ))}
              </ul>
            ) : links.length === 0 ? (
              <div className="text-center py-12">
                <LinkIcon size={32} className="mx-auto mb-3 text-fg-muted" />
                <p className="font-medium text-fg">No payment links yet</p>
                <p className="text-[12px] text-fg-muted mt-1">
                  Create your first link to start collecting payments.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {links.map((l) => {
                  const url = `https://${LINK_URL_BASE}${l.token}`;
                  const canDisable = !TERMINAL.has(l.status);
                  const canResend = ['SENT', 'OPENED', 'STARTED', 'ABANDONED'].includes(l.status);
                  return (
                    <li
                      key={l.id}
                      className="grid grid-cols-12 px-5 py-3 items-center hover:bg-bg-muted/40 text-[13px]"
                    >
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
                        {formatCurrencyCents(l.amount)}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={resendMutation.isPending}
                            onClick={() => resendMutation.mutate(l.id)}
                          >
                            Resend
                          </Button>
                        )}
                        {canDisable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={disableMutation.isPending}
                            onClick={() => disableMutation.mutate(l.id)}
                          >
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
              <p className="text-[11px] text-fg-muted">
                Activity timeline + refund flow coming next round.
              </p>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
