'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  Button,
  StatusPill,
  Banner,
  ArrowRightIcon,
  CheckIcon,
  BoltIcon,
  ShieldIcon,
  BankIcon,
  RouteIcon,
  WebhookIcon,
  ChartIcon,
  CopyIcon,
  ExternalIcon,
} from '@eazepay/ui/web';
import { BRANDS } from '@eazepay/shared-types';
import {
  MARKETPLACES,
  TIER_LABEL,
  AUTH_LABEL,
  CATEGORY_LABEL,
  type Marketplace,
} from '../../lib/marketplaces-data';

/**
 * Lender Marketplaces — toggle which third-party aggregators plug into
 * the EazePay rail, per vertical.
 *
 * Flipping a toggle pushes the change to every brand application live
 * within ~250ms via the orchestration engine's hot-reload of its
 * routing config. Per-business overrides flow through to the brand
 * portal's "Lender Access" matrix.
 */

const FMT_CENTS = (c: number) =>
  c >= 1_000_000_00
    ? `$${(c / 1_000_000_00).toFixed(1)}M`
    : c >= 1_000_00
      ? `$${Math.round(c / 1_000_00)}k`
      : `$${(c / 100).toFixed(0)}`;

const BRAND_KEYS: Array<'tradepay' | 'medpay' | 'coachpay'> = [
  'tradepay',
  'medpay',
  'coachpay',
];

export default function MarketplacesPage() {
  const [rows, setRows] = useState<Marketplace[]>(MARKETPLACES);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleGlobal = (id: string) => {
    setRows((s) =>
      s.map((m) => (m.id === id ? { ...m, globallyEnabled: !m.globallyEnabled } : m)),
    );
  };
  const toggleBrand = (id: string, brand: (typeof BRAND_KEYS)[number]) => {
    setRows((s) =>
      s.map((m) =>
        m.id === id
          ? {
              ...m,
              enabledByBrand: {
                ...m.enabledByBrand,
                [brand]: !m.enabledByBrand[brand],
              },
            }
          : m,
      ),
    );
  };

  const totals = useMemo(() => {
    const active = rows.filter((m) => m.globallyEnabled);
    return {
      active: active.length,
      total: rows.length,
      lenders: active.reduce((s, m) => s + m.lenderCount, 0),
      volume30d: active.reduce((s, m) => s + m.metrics.fundedVolume30dCents, 0),
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Lender Integrations' }, { label: 'Marketplaces' }]}
        title="Lender Marketplaces"
        description="Third-party aggregators we plug into. Toggling a marketplace on for a vertical instantly enables its full lender roster for every business in that brand. Per-business overrides live on the business detail page."
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Link href="/docs">
              <Button size="sm" variant="ghost">
                Endpoint docs
              </Button>
            </Link>
            <Link href="/lenders">
              <Button size="sm" variant="secondary">
                Public hub
              </Button>
            </Link>
            <Button size="sm" onClick={() => flash('Marketplace onboarding wizard opening')}>Add marketplace</Button>
          </div>
        }
        meta={
          <>
            <StatusPill tone="success" dot>
              {totals.active}/{totals.total} active
            </StatusPill>
            <StatusPill tone="neutral">{totals.lenders} aggregated lenders</StatusPill>
            <StatusPill tone="neutral">{FMT_CENTS(totals.volume30d)} funded (30d)</StatusPill>
          </>
        }
      />

      <PageBody>
        <Banner intent="info" className="mb-4">
          <strong>How toggling works.</strong> Each marketplace exposes its own lender roster. When
          you flip a brand toggle, every active customer on that brand starts seeing offers from
          that marketplace within ~250ms. Disabling a marketplace gracefully drains the queue —
          in-flight applications complete, new ones skip the marketplace.
        </Banner>

        {/* ── Marketplace toggle grid ── */}
        <div className="space-y-3">
          {rows.map((m) => (
            <MarketplaceCard
              key={m.id}
              m={m}
              expanded={editing === m.id}
              onToggleGlobal={() => toggleGlobal(m.id)}
              onToggleBrand={(b) => toggleBrand(m.id, b)}
              onExpand={() => setEditing(editing === m.id ? null : m.id)}
              flash={flash}
            />
          ))}
        </div>

        {/* ── How it connects (the explainer for showing lenders) ── */}
        <Card className="mt-6">
          <CardHeader
            title="How marketplaces connect to EazePay"
            description="Send a prospective marketplace this section to show them exactly how they plug into the rail."
            action={
              <Link href="/docs">
                <Button size="sm" variant="secondary">
                  Full API reference <ExternalIcon size={12} />
                </Button>
              </Link>
            }
          />
          <CardBody>
            <ol className="space-y-4">
              {[
                {
                  step: 1,
                  icon: <BoltIcon size={14} />,
                  title: 'Customer hits a brand apply link',
                  body: 'eazemedpay.com/?ref=<partner> · we normalise the application via /api/v1/applications.',
                },
                {
                  step: 2,
                  icon: <RouteIcon size={14} />,
                  title: 'Orchestration fans out',
                  body: 'For every marketplace enabled on the customer\'s brand + tier, EazePay POSTs the application context in parallel (5s soft / 8s hard timeout).',
                },
                {
                  step: 3,
                  icon: <BankIcon size={14} />,
                  title: 'Marketplace fans out to its lenders',
                  body: 'engine.tech / FinWise / HSP / HomeImp Co. — each runs its own waterfall against its lender roster and returns aggregated offers.',
                },
                {
                  step: 4,
                  icon: <ChartIcon size={14} />,
                  title: 'EazePay aggregates + ranks',
                  body: 'Offers from every marketplace flow into one ranked list. Consumer-best by total cost. We dedupe identical lender+amount+APR offers.',
                },
                {
                  step: 5,
                  icon: <CheckIcon size={14} />,
                  title: 'Customer accepts',
                  body: 'EazePay calls the winning marketplace\'s /bind endpoint. The marketplace handles e-sign, TILA, funding.',
                },
                {
                  step: 6,
                  icon: <WebhookIcon size={14} />,
                  title: 'Status webhooks',
                  body: 'Marketplace POSTs lifecycle events back to /api/v1/webhooks/lenders/<marketplace_id>. HMAC-SHA256 signed. Idempotent. Replay-protected.',
                },
              ].map((s) => (
                <li key={s.step} className="flex items-start gap-3">
                  <span className="size-7 rounded-md bg-bg-inverse text-white flex items-center justify-center font-semibold text-[11px] shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-fg flex items-center gap-1.5">
                      <span className="text-fg-muted">{s.icon}</span>
                      {s.title}
                    </p>
                    <p className="text-[12px] text-fg-muted leading-relaxed mt-0.5">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        {/* ── Endpoint quick reference ── */}
        <Card className="mt-4">
          <CardHeader
            title="Endpoint quick reference"
            description="Drop these into a marketplace's integration checklist."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {[
                {
                  method: 'POST',
                  url: '/api/v1/orchestration/route',
                  direction: 'EazePay → marketplace fan-out',
                  body: 'application_id · brand · amount_cents · tier',
                },
                {
                  method: 'POST',
                  url: '/api/v1/lenders/{marketplace_id}/quote',
                  direction: 'Per-marketplace quote call',
                  body: 'applicant context · request · permissible_purpose',
                },
                {
                  method: 'POST',
                  url: '/api/v1/offers/{id}/accept',
                  direction: 'EazePay → marketplace bind',
                  body: 'offer_id, returns TILA + e-sign envelope',
                },
                {
                  method: 'POST',
                  url: '/api/v1/webhooks/lenders/{marketplace_id}',
                  direction: 'Marketplace → EazePay (inbound)',
                  body: 'event_type · loan_id · status payload',
                },
                {
                  method: 'GET',
                  url: '/api/v1/lenders?brand=medpay',
                  direction: 'Marketplace registry lookup',
                  body: 'Returns every active adapter + envelope',
                },
              ].map((r) => (
                <li
                  key={r.url}
                  className="grid grid-cols-12 px-5 py-3 items-center text-[12px] hover:bg-bg-muted/40"
                >
                  <span
                    className={
                      'col-span-1 text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 inline-flex justify-center ' +
                      (r.method === 'GET'
                        ? 'bg-bg-muted text-fg-secondary'
                        : 'bg-bg-inverse text-white')
                    }
                  >
                    {r.method}
                  </span>
                  <code className="col-span-4 font-mono text-fg text-[12px] truncate">
                    {r.url}
                  </code>
                  <span className="col-span-3 text-fg-secondary">{r.direction}</span>
                  <span className="col-span-4 text-fg-muted">{r.body}</span>
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

function MarketplaceCard({
  m,
  expanded,
  onToggleGlobal,
  onToggleBrand,
  onExpand,
  flash,
}: {
  m: Marketplace;
  expanded: boolean;
  onToggleGlobal: () => void;
  onToggleBrand: (brand: (typeof BRAND_KEYS)[number]) => void;
  onExpand: () => void;
  flash: (msg: string) => void;
}) {
  return (
    <Card>
      <CardBody className="p-0">
        <div className="grid grid-cols-12 items-center px-5 py-3 gap-3">
          <div className="col-span-4 flex items-center gap-3 min-w-0">
            <span className="size-10 rounded-lg bg-bg-inverse text-white font-bold text-[16px] flex items-center justify-center shrink-0">
              {m.logoLetter}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                {m.displayName}
                <StatusPill tone="neutral">{CATEGORY_LABEL[m.category]}</StatusPill>
              </p>
              <p className="text-[11px] text-fg-muted truncate">{m.tagline}</p>
            </div>
          </div>
          <div className="col-span-2 text-[12px]">
            <p className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">
              Lenders
            </p>
            <p className="text-fg font-semibold mt-0.5">{m.lenderCount}</p>
          </div>
          <div className="col-span-2 text-[12px]">
            <p className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">
              Funded (30d)
            </p>
            <p className="text-fg font-semibold mt-0.5">{FMT_CENTS(m.metrics.fundedVolume30dCents)}</p>
          </div>
          <div className="col-span-2 text-[12px]">
            <p className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">
              P95 latency
            </p>
            <p className="text-fg font-semibold mt-0.5">{m.metrics.p95LatencyMs}ms</p>
          </div>
          <div className="col-span-2 flex items-center justify-end gap-2">
            <Toggle
              on={m.globallyEnabled}
              onChange={onToggleGlobal}
              ariaLabel={`${m.displayName} global toggle`}
            />
            <Button size="sm" variant="ghost" onClick={onExpand}>
              {expanded ? 'Collapse' : 'Configure'}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border bg-bg-muted/30 px-5 py-4 space-y-4">
            {/* Brand toggle row */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2">
                Verticals
              </p>
              <p className="text-[12px] text-fg-muted mb-3 max-w-2xl">
                Toggling a brand fans the change out to every business in that vertical. The
                business&apos;s per-merchant override (set on the business detail page) takes
                precedence over this default.
              </p>
              <div className="flex flex-wrap gap-2">
                {BRAND_KEYS.map((b) => {
                  const on = m.enabledByBrand[b];
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onToggleBrand(b)}
                      disabled={!m.globallyEnabled}
                      className={
                        'h-9 inline-flex items-center gap-2 px-3 rounded-md text-[12px] font-semibold transition-all border disabled:opacity-40 ' +
                        (on
                          ? 'bg-bg-inverse text-white border-bg-inverse'
                          : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong')
                      }
                    >
                      <span
                        className={
                          'size-2 rounded-full ' + (on ? 'bg-white' : 'bg-border-strong')
                        }
                      />
                      {BRANDS[b].name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tier coverage */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2">
                Tier coverage
              </p>
              <div className="flex flex-wrap gap-2">
                {(['prime_plus', 'prime', 'near_prime', 'sub_prime'] as const).map((t) => {
                  const serves = m.servesTiers.includes(t);
                  return (
                    <span
                      key={t}
                      className={
                        'text-[11px] font-medium px-2.5 py-1 rounded-full border ' +
                        (serves
                          ? 'bg-bg-elevated border-border text-fg'
                          : 'bg-bg-muted border-border text-fg-muted line-through')
                      }
                    >
                      {TIER_LABEL[t]}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Connection details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Detail
                label="API base URL"
                value={m.apiBaseUrl}
                copyable
              />
              <Detail
                label="Auth method"
                value={AUTH_LABEL[m.authMethod]}
              />
              <Detail
                label="Their webhook (we POST → them)"
                value={m.theirWebhookUrl}
                copyable
              />
              <Detail
                label="Our webhook (they POST → us)"
                value={m.ourWebhookUrl}
                copyable
              />
            </div>

            {/* Live perf */}
            <div className="grid grid-cols-3 gap-2">
              <Metric
                label="30d approval rate"
                value={`${Math.round(m.metrics.approvalRate30d * 100)}%`}
              />
              <Metric
                label="Webhook delivery (30d)"
                value={`${(m.metrics.deliveryRate30d * 100).toFixed(2)}%`}
              />
              <Metric label="P95 latency" value={`${m.metrics.p95LatencyMs}ms`} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" onClick={() => flash(`${m.displayName} probe completed — 12ms`)}>
                Test connection
              </Button>
              <Button size="sm" variant="secondary" onClick={() => flash(`${m.displayName} keys rotated`)}>
                Rotate keys
              </Button>
              <Button size="sm" onClick={() => flash(`${m.displayName} settings saved`)}>Save changes</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Toggle({
  on,
  onChange,
  ariaLabel,
}: {
  on: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={ariaLabel}
      aria-pressed={on}
      className={
        'h-6 w-11 rounded-full transition-colors relative shrink-0 ' +
        (on ? 'bg-[#0d1530]' : 'bg-bg-muted border border-border')
      }
    >
      <span
        className={
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ' +
          (on ? 'left-5' : 'left-0.5')
        }
      />
    </button>
  );
}

function Detail({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5 min-w-0">
        <code className="flex-1 font-mono text-[11px] text-fg bg-bg-elevated border border-border rounded px-2 py-1 truncate">
          {value}
        </code>
        {copyable && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-fg-muted hover:text-fg shrink-0"
          >
            {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
        {label}
      </p>
      <p className="text-[15px] font-semibold text-fg leading-none mt-1">{value}</p>
    </div>
  );
}
