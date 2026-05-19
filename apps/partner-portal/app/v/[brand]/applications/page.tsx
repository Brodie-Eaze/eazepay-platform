'use client';
import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  KpiCard,
  Button,
  StatusPill,
  type StatusTone,
  Input,
  Select,
  DataTable,
  Money,
  Tabs,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import {
  applicationsForPartner,
  findPartner,
  type ApplicationRow,
} from '../../../../lib/master-data';
import {
  DEMO_PARTNER_BY_BRAND,
  readCurrentPartnerIdFromDemoCookie,
  readSubmittedAppsForPartner,
  toLegacyRow,
  type SubmittedAppBrand,
} from '../../../../lib/submitted-applications';
import { fetchApplicationsForPartner } from '../../../../lib/applications-client';

/* ─── Live-tracking shapes — mirror the BFF status route response.
 * Duplicated locally rather than importing from the server-only store
 * so the client bundle stays slim. */
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

const LIVE_STATUS_TONE: Record<LiveStatus, StatusTone> = {
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

interface ConsumerInviteRow {
  token: string;
  applicationId: string | null;
  salespersonEmail: string;
}

/* Demo salesperson — same constant the send-link page uses for the
 * "Show only my invites" chip until Clerk lands. */
const DEMO_SALESPERSON_EMAIL = 'sales@partner.test';

function timeAgoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const slugToBrand = (slug: string): BrandCode | null =>
  BRAND_ORDER.find((c) => BRANDS[c].slug === slug) ?? null;

const productCodeForBrand = (b: BrandCode): 'med-pay' | 'trade-pay' | 'coach-pay' | null => {
  if (b === 'medpay') return 'med-pay';
  if (b === 'tradepay') return 'trade-pay';
  if (b === 'coachpay') return 'coach-pay';
  return null;
};

const statusPill = (s: ApplicationRow['status']) => {
  if (s === 'funded') return <StatusPill tone="success">Funded</StatusPill>;
  if (s === 'approved') return <StatusPill tone="success">Approved</StatusPill>;
  if (s === 'declined') return <StatusPill tone="danger">Declined</StatusPill>;
  if (s === 'in_review')
    return (
      <StatusPill tone="warning" dot>
        In review
      </StatusPill>
    );
  return (
    <StatusPill tone="info" dot>
      Submitted
    </StatusPill>
  );
};

export default function VerticalApplicationsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const router = useRouter();
  const brand = slugToBrand(brandSlug);
  if (!brand) notFound();
  const spec = BRANDS[brand];

  const code = productCodeForBrand(brand);

  /**
   * Resolve the current session's partner identity, then scope the
   * application list to that partner. This is the hardening boundary
   * for PII isolation on this page: partner A must NEVER see partner
   * B's applications.
   *
   * Resolution order:
   *   1. The `eazepay_demo` cookie's brand → DEMO_PARTNER_BY_BRAND
   *      binding (medpay → p_helio, tradepay → p_orion, coachpay → p_atlas).
   *   2. Fallback: the brand's demo partner, so a freshly-loaded page
   *      that hasn't seen the cookie yet still scopes correctly.
   *
   * In production, this read comes from the BFF (`/api/me`) which
   * returns the merchantId bound to the session — never the URL,
   * query string, or any user-supplied input. See ADR-0016 / 0017.
   */
  const [currentPartnerId, setCurrentPartnerId] = useState<string>(() => {
    if (brand === 'medpay' || brand === 'tradepay' || brand === 'coachpay') {
      return DEMO_PARTNER_BY_BRAND[brand];
    }
    return '';
  });
  useEffect(() => {
    const fromCookie = readCurrentPartnerIdFromDemoCookie();
    if (fromCookie) setCurrentPartnerId(fromCookie);
  }, []);

  // Submitted apps for THIS partner only. Hardened reader chain:
  //   1. Try the server-side API (/api/v/<brand>/applications) — DB-
  //      backed, canonical source once Postgres is provisioned.
  //   2. Fall back to localStorage-backed `readSubmittedAppsForPartner`
  //      when the API responds 503 db_unavailable or any network error.
  // Both paths are partner-scoped: the API filters server-side using
  // the session cookie; localStorage filters via the strict-equality
  // reader. No cross-partner leakage in either branch.
  const [submittedForPartner, setSubmittedForPartner] = useState<ApplicationRow[]>([]);
  const [submittedSource, setSubmittedSource] = useState<'api' | 'local'>('local');
  useEffect(() => {
    if (!currentPartnerId || !code) {
      setSubmittedForPartner([]);
      return;
    }
    let cancelled = false;
    const brandSubmittedBrand = brand as SubmittedAppBrand;
    void (async () => {
      const { source, rows } = await fetchApplicationsForPartner(
        brandSubmittedBrand,
        currentPartnerId,
      );
      if (cancelled) return;
      setSubmittedSource(source);
      setSubmittedForPartner(
        rows.map(
          (r): ApplicationRow => ({
            id: r.id,
            customer: r.customer,
            customerEmail: r.customerEmail,
            partner: r.partner,
            product: r.product,
            amountCents: r.amountCents,
            fico: r.fico,
            lender: r.lender,
            status: r.status,
            date: r.date,
          }),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPartnerId, code, brand]);
  /* Mute lint: submittedSource is consumed by a follow-up PR that adds
     a "demo data" banner. Wired now so the data plumbing is testable. */
  void submittedSource;
  void readSubmittedAppsForPartner;
  void toLegacyRow;

  // Final row set: this partner's submitted apps (newest first) +
  // their seeded historical apps, filtered to this brand.
  const seedRows = code
    ? applicationsForPartner(currentPartnerId).filter((a) => a.product === code)
    : [];
  const rows: ApplicationRow[] = [...submittedForPartner, ...seedRows];

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [toast, setToast] = useState<string | null>(null);
  const [onlyMyInvites, setOnlyMyInvites] = useState(false);

  /* Pull invites the current salesperson minted for this brand — used
   * by the "Show only my invites" chip + to know which applications
   * to show live-tracking pulses for. */
  const consumerBrandSlug = brand === 'direct' ? null : brand;
  const [myInvites, setMyInvites] = useState<ConsumerInviteRow[]>([]);
  useEffect(() => {
    if (!consumerBrandSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v/${consumerBrandSlug}/consumer-invites?salespersonEmail=${encodeURIComponent(DEMO_SALESPERSON_EMAIL)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { invites: ConsumerInviteRow[] };
        if (!cancelled) setMyInvites(body.invites ?? []);
      } catch {
        /* ignore — list stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consumerBrandSlug]);

  /* Set of applicationIds that the current salesperson invited. */
  const myAppIds = useMemo(() => {
    const s = new Set<string>();
    for (const inv of myInvites) if (inv.applicationId) s.add(inv.applicationId);
    return s;
  }, [myInvites]);

  /* Poll live status for every application visible in the table.
   * Capped at the brand's filtered roster so we don't fan out across
   * the whole canonical seed. */
  const [liveStatusById, setLiveStatusById] = useState<
    Record<string, { status: LiveStatus; lastUpdatedAt: string }>
  >({});
  const [liveStatusError, setLiveStatusError] = useState(false);
  function exportCsv() {
    if (typeof window !== 'undefined') {
      try {
        const csv = [
          'id,customer,partner,amount_cents,fico,lender,status,date',
          ...rows.map((a) =>
            [
              a.id,
              a.customer,
              a.partner.replace(/,/g, ''),
              a.amountCents,
              a.fico,
              a.lender,
              a.status,
              a.date,
            ].join(','),
          ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${spec.slug}-applications-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        /* fall-through */
      }
    }
    setToast(`Exported ${rows.length} rows`);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = rows.filter((a) => {
    if (tab !== 'all' && a.status !== tab) return false;
    if (onlyMyInvites && !myAppIds.has(a.id)) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        a.customer.toLowerCase().includes(q) ||
        a.partner.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.lender.toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* Live-status polling — visible rows only, every 15s. Errors are
   * surfaced once (banner row above the table) instead of console-spam. */
  useEffect(() => {
    if (!consumerBrandSlug) return;
    const targets = filtered.map((a) => a.id);
    if (targets.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const updates: Record<string, { status: LiveStatus; lastUpdatedAt: string }> = {};
      let hadError = false;
      await Promise.all(
        targets.map(async (id) => {
          try {
            const res = await fetch(
              `/api/v/${consumerBrandSlug}/applications/${encodeURIComponent(id)}/status`,
              { credentials: 'include' },
            );
            if (!res.ok) {
              hadError = true;
              return;
            }
            const body = (await res.json()) as { status: LiveStatus; lastUpdatedAt: string };
            updates[id] = { status: body.status, lastUpdatedAt: body.lastUpdatedAt };
          } catch {
            hadError = true;
          }
        }),
      );
      if (cancelled) return;
      if (Object.keys(updates).length) {
        setLiveStatusById((prev) => ({ ...prev, ...updates }));
      }
      setLiveStatusError(hadError && Object.keys(updates).length === 0);
    };
    void tick();
    const interval = window.setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    /* Re-arm when the filtered roster changes (eg. user toggles tabs);
     * we depend on the id list rather than the array ref so the effect
     * isn't reborn on every keystroke. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumerBrandSlug, filtered.map((a) => a.id).join(',')]);

  const tabs = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'funded', label: 'Funded', count: rows.filter((a) => a.status === 'funded').length },
    {
      key: 'approved',
      label: 'Approved',
      count: rows.filter((a) => a.status === 'approved').length,
    },
    {
      key: 'submitted',
      label: 'Submitted',
      count: rows.filter((a) => a.status === 'submitted').length,
    },
    {
      key: 'declined',
      label: 'Declined',
      count: rows.filter((a) => a.status === 'declined').length,
    },
  ];

  const columns: Column<ApplicationRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: (a) => (
        <div className="flex items-center gap-2">
          {myAppIds.has(a.id) && (
            <span
              className="size-1.5 rounded-full bg-info animate-pulse shrink-0"
              aria-label="Your invite"
              title="You sent this consumer the financing link"
            />
          )}
          <div>
            <div className="font-medium">{a.customer}</div>
            <div className="text-[12px] text-fg-muted">{a.customerEmail}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Partner',
      cell: (a) => <span className="text-[13px]">{a.partner}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (a) => <Money cents={a.amountCents} noFractions />,
    },
    {
      key: 'fico',
      header: 'Credit',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{a.fico}</span>,
    },
    {
      key: 'lender',
      header: 'Lender',
      cell: (a) => <span className="text-[13px]">{a.lender}</span>,
    },
    { key: 'status', header: 'Status', cell: (a) => statusPill(a.status) },
    {
      key: 'live',
      header: 'Live tracking',
      cell: (a) => {
        const live = liveStatusById[a.id];
        if (!live) {
          return (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
              <span className="size-1.5 rounded-full bg-bg-muted" aria-hidden />
              waiting
            </span>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-info animate-pulse shrink-0" aria-hidden />
            <StatusPill tone={LIVE_STATUS_TONE[live.status]}>
              {LIVE_STATUS_LABEL[live.status]}
            </StatusPill>
            <span className="text-[10px] font-mono text-fg-muted shrink-0">
              {timeAgoShort(live.lastUpdatedAt)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      cell: (a) => <span className="text-[12px] text-fg-muted tabular-nums">{a.date}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master', href: '/' },
          { label: spec.name, href: `/v/${spec.slug}` },
          { label: 'Applications' },
        ]}
        title={`${spec.name} applications`}
        description={`Every consumer application routed to or originated from ${spec.name} this month.`}
        actions={<Button onClick={exportCsv}>Export CSV</Button>}
        meta={
          <>
            <StatusPill tone="accent">{spec.name}</StatusPill>
            <StatusPill tone="neutral">{rows.length} total</StatusPill>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Funded" value={rows.filter((a) => a.status === 'funded').length} />
          <KpiCard label="Approved" value={rows.filter((a) => a.status === 'approved').length} />
          <KpiCard label="Submitted" value={rows.filter((a) => a.status === 'submitted').length} />
          <KpiCard
            label="Funded vol"
            value={
              <Money
                cents={rows
                  .filter((a) => a.status === 'funded')
                  .reduce((a, b) => a + b.amountCents, 0)}
                compact
              />
            }
          />
        </div>

        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Input
              leadingIcon={<SearchIcon size={14} />}
              placeholder="Search by customer, partner, lender…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:col-span-2"
            />
            <Select
              label=""
              defaultValue=""
              options={[
                { value: '', label: 'All Months' },
                { value: '2026-05', label: 'May 2026' },
                { value: '2026-04', label: 'April 2026' },
                { value: '2026-03', label: 'March 2026' },
              ]}
            />
          </div>
          <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setOnlyMyInvites((v) => !v)}
              className={
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ' +
                (onlyMyInvites
                  ? 'bg-accent-soft text-accent border-accent/30'
                  : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong')
              }
              aria-pressed={onlyMyInvites}
            >
              <span
                className={'size-1.5 rounded-full ' + (onlyMyInvites ? 'bg-accent' : 'bg-fg-muted')}
              />
              Show only my invites
              <span className="text-fg-muted font-mono">({myAppIds.size})</span>
            </button>
            {liveStatusError && (
              <p className="text-[11px] text-warning font-medium">
                Live updates paused. Refresh the page to retry.
              </p>
            )}
          </div>
        </Card>

        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />
        <Card>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(a) => a.id}
            dense
            empty={`No ${spec.name} applications match.`}
            onRowClick={(a) => router.push(`/v/${spec.slug}/applications/${a.id}`)}
          />
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
