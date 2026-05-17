import Link from 'next/link';
import {
  ArrowRightIcon,
  BankIcon,
  BoltIcon,
  CheckIcon,
  ChartIcon,
  RouteIcon,
  ShieldIcon,
} from '@eazepay/ui/web';
import { SAMPLE_LENDERS } from '../../lib/api-v1/shared';

/**
 * Public lender developer hub — `/lenders`.
 *
 * Lives outside the authenticated portal so a prospective lender can
 * preview the marketplace before signing an integration agreement.
 * Shows:
 *   - The lenders already on the orchestration rail (cards)
 *   - How EazePay routes applications to them
 *   - Headline integration endpoints with copy-able URLs
 *   - CTA to the full developer docs at /docs and the API reference
 *
 * Pure server component — no client-side JS — so it renders fast and
 * looks identical to a marketing page rather than a portal screen.
 */

const fmtAmount = (cents: number) =>
  cents >= 100_000_00 ? `$${Math.round(cents / 100_000) / 10}M` : `$${Math.round(cents / 1000)}k`;

const fmtApr = (bps: { min: number; max: number }) =>
  `${(bps.min / 100).toFixed(1)}% – ${(bps.max / 100).toFixed(1)}% APR`;

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/applications',
    summary: 'Create a normalised application — our orchestration starts the waterfall.',
  },
  {
    method: 'POST',
    path: '/api/v1/orchestration/evaluate',
    summary: 'Eligibility-only check, no bureau hit — returns the candidate lender set.',
  },
  {
    method: 'POST',
    path: '/api/v1/orchestration/route',
    summary: 'Run the tiered hybrid waterfall, aggregate offers, rank consumer-best.',
  },
  {
    method: 'GET',
    path: '/api/v1/applications/{id}/offers',
    summary: 'Fetch offers aggregated across every eligible lender adapter.',
  },
  {
    method: 'POST',
    path: '/api/v1/lenders/{lender_id}/quote',
    summary: 'Reference shape of the request EazePay POSTs to your adapter.',
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks/lenders/{lender}',
    summary: 'You post lifecycle events back here. HMAC-signed, replay-protected.',
  },
];

export default function PublicLenderHubPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* ─── Header ─── */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-[#0d1530] flex items-center justify-center shadow-sm">
              <BoltIcon size={16} className="text-white" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight text-[#0d1530]">EazePay</div>
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-gray-500 -mt-0.5">
                Lender Marketplace
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-gray-700">
            <a href="#lenders" className="hover:text-gray-900">
              Lenders
            </a>
            <a href="#how" className="hover:text-gray-900">
              How routing works
            </a>
            <a href="#endpoints" className="hover:text-gray-900">
              API endpoints
            </a>
            <Link href="/docs" className="hover:text-gray-900">
              Full docs
            </Link>
          </nav>
          <Link
            href="/docs"
            className="h-9 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] flex items-center gap-2"
          >
            Developer docs
            <ArrowRightIcon size={13} />
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: 'radial-gradient(ellipse at top, #eef2ff 0%, #ffffff 60%, #f8fafc 100%)',
          }}
        />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold text-gray-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Open for new lender adapters
          </span>
          <h1 className="mt-5 text-[44px] md:text-[58px] font-bold tracking-tight leading-[1.05] text-[#0d1530] max-w-3xl mx-auto">
            Plug into a multi-brand <span style={{ color: '#5d8bff' }}>orchestration rail</span>.
          </h1>
          <p className="mt-5 text-[15px] md:text-[16px] text-gray-600 max-w-2xl mx-auto leading-relaxed">
            EazePay routes every soft-pull-qualified application to every eligible lender adapter,
            in parallel, ranked consumer-best. One normalised payload, one HMAC scheme, one
            audit-trail — across TradePay, MedPay, CoachPay, and direct consumer surfaces.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="#endpoints"
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] inline-flex items-center gap-2"
            >
              See the endpoints
              <ArrowRightIcon size={13} />
            </Link>
            <Link
              href="/docs"
              className="h-11 px-6 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold text-[14px] inline-flex items-center gap-2"
            >
              Read the integration guide
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-gray-500 uppercase tracking-[0.18em] font-semibold">
            HMAC-SHA256 · 5-min replay window · RFC 7807 errors · Idempotent retries
          </p>
        </div>
      </section>

      {/* ─── Stats bar ─── */}
      <section className="bg-[#0d1530] text-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: SAMPLE_LENDERS.length.toString(), l: 'Active lender adapters' },
            { v: '3', l: 'Consumer-facing brands' },
            { v: '< 800ms', l: 'P95 orchestration' },
            { v: '99.95%', l: 'Webhook delivery (24h)' },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-[32px] md:text-[38px] font-bold tracking-tight">{s.v}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold mt-1">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How routing works ─── */}
      <section id="how" className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <p className="text-[12px] uppercase tracking-[0.22em] font-semibold text-gray-500 text-center">
          How routing works
        </p>
        <h2 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight text-center text-[#0d1530]">
          One application, every eligible lender.
        </h2>
        <p className="mt-3 text-[14px] text-gray-600 text-center max-w-2xl mx-auto">
          Each step below is a public endpoint your team can hit from a sandbox key. Cards below
          show the exact path, method, and the canonical payload shape.
        </p>

        <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              n: 1,
              icon: <BoltIcon size={16} />,
              title: 'Intake',
              body: 'Consumer hits a brand apply link. EazePay collects soft-pull consent and normalises the payload.',
              endpoint: 'POST /api/v1/applications',
            },
            {
              n: 2,
              icon: <RouteIcon size={16} />,
              title: 'Eligibility',
              body: 'Knockouts → affordability → state APR caps → MLA / SCRA → brand allowlist → tier match.',
              endpoint: 'POST /api/v1/orchestration/evaluate',
            },
            {
              n: 3,
              icon: <BankIcon size={16} />,
              title: 'Route',
              body: 'Parallel quote within tier; waterfall across tiers; aggregate, dedupe, rank consumer-best.',
              endpoint: 'POST /api/v1/orchestration/route',
            },
            {
              n: 4,
              icon: <CheckIcon size={16} />,
              title: 'Bind + fund',
              body: 'Consumer accepts → e-sign + TILA → lender confirms → bank-of-record disburses.',
              endpoint: 'POST /api/v1/offers/{id}/accept',
            },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="size-7 rounded-full bg-[#0d1530] text-white text-[12px] font-bold flex items-center justify-center">
                  {step.n}
                </span>
                <span
                  className="size-7 rounded-md flex items-center justify-center"
                  style={{ background: '#eef2ff', color: '#1e3a8a' }}
                >
                  {step.icon}
                </span>
              </div>
              <h3 className="text-[15px] font-bold tracking-tight text-[#0d1530]">{step.title}</h3>
              <p className="mt-1.5 text-[13px] text-gray-600 leading-relaxed">{step.body}</p>
              <code className="block mt-3 font-mono text-[11px] text-gray-700 bg-gray-50 rounded px-2 py-1.5">
                {step.endpoint}
              </code>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── Live lender directory ─── */}
      <section id="lenders" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <p className="text-[12px] uppercase tracking-[0.22em] font-semibold text-gray-500 text-center">
            Live marketplace
          </p>
          <h2 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight text-center text-[#0d1530]">
            {SAMPLE_LENDERS.length} active lender adapters
          </h2>
          <p className="mt-3 text-[14px] text-gray-600 text-center max-w-2xl mx-auto">
            Brands, served tiers, APR windows, and the SLA we hold each adapter to. Click into any
            lender to see the exact endpoint, sample payload, and integration status.
          </p>

          <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAMPLE_LENDERS.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-10 rounded-lg flex items-center justify-center font-bold text-[16px]"
                      style={{ background: '#eef2ff', color: '#1e3a8a' }}
                    >
                      {l.display_name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold tracking-tight text-[#0d1530] truncate">
                        {l.display_name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{l.legal_name}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 inline-flex items-center gap-1 shrink-0">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-y-2 gap-x-3 text-[12px]">
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                    Brands
                  </dt>
                  <dd className="text-gray-800 font-medium">{l.brands.join(' · ')}</dd>
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                    APR band
                  </dt>
                  <dd className="text-gray-800 font-medium">{fmtApr(l.apr_band_bps)}</dd>
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                    Envelope
                  </dt>
                  <dd className="text-gray-800 font-medium">
                    {fmtAmount(l.min_amount_cents)} – {fmtAmount(l.max_amount_cents)}
                  </dd>
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                    P95 SLA
                  </dt>
                  <dd className="text-gray-800 font-medium">{l.sla_p95_ms}ms</dd>
                </dl>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <code className="font-mono text-[11px] text-gray-700 bg-gray-50 rounded px-1.5 py-0.5">
                    {l.id}
                  </code>
                  <Link
                    href={`/lenders/${l.id}`}
                    className="text-[12px] font-semibold text-[#0d1530] hover:underline inline-flex items-center gap-1"
                  >
                    View integration <ArrowRightIcon size={11} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Endpoints ─── */}
      <section id="endpoints" className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <p className="text-[12px] uppercase tracking-[0.22em] font-semibold text-gray-500 text-center">
          Endpoints
        </p>
        <h2 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight text-center text-[#0d1530]">
          Plug into the rail with six endpoints.
        </h2>
        <p className="mt-3 text-[14px] text-gray-600 text-center max-w-2xl mx-auto">
          All endpoints accept JSON, return RFC 7807 error bodies, and live under{' '}
          <code className="font-mono text-[12px] bg-gray-100 rounded px-1.5 py-0.5">
            https://api.eazepay.com
          </code>
          . Demo traffic is allowed without a signature so you can curl them before issuing keys.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {ENDPOINTS.map((e, i) => (
            <Link
              key={e.path}
              href={`/docs#${e.path.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
              className={
                'flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ' +
                (i < ENDPOINTS.length - 1 ? 'border-b border-gray-100' : '')
              }
            >
              <span
                className={
                  'text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 shrink-0 ' +
                  (e.method === 'GET'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-emerald-50 text-emerald-700')
                }
              >
                {e.method}
              </span>
              <code className="font-mono text-[13px] text-gray-900 shrink-0">{e.path}</code>
              <span className="flex-1 text-[12px] text-gray-600 hidden md:inline">{e.summary}</span>
              <ArrowRightIcon size={13} className="text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-900 text-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-gray-400">
              Try it from your terminal
            </span>
            <span className="text-[11px] text-gray-500">No auth required in demo mode</span>
          </div>
          <pre className="font-mono text-[12px] leading-relaxed p-5 overflow-x-auto">{`# Fetch every lender on the rail, filtered to MedPay
curl -s https://api.eazepay.com/api/v1/lenders?brand=medpay | jq

# Run the eligibility check
curl -s https://api.eazepay.com/api/v1/orchestration/evaluate \\
  -X POST -H "Content-Type: application/json" \\
  -d '{
    "application_id":"app_demo_001",
    "brand":"tradepay",
    "amount_cents":1850000,
    "tier":"prime"
  }' | jq

# Run the full waterfall
curl -s https://api.eazepay.com/api/v1/orchestration/route \\
  -X POST -H "Content-Type: application/json" \\
  -d '{
    "application_id":"app_demo_001",
    "brand":"tradepay",
    "amount_cents":1850000,
    "term_months":60,
    "tier":"prime"
  }' | jq`}</pre>
        </div>
      </section>

      {/* ─── Compliance footer band ─── */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            {
              i: <ShieldIcon size={18} />,
              t: 'Audit-grade',
              s: 'Append-only hash-chained audit log on every decision.',
            },
            {
              i: <ChartIcon size={18} />,
              t: 'Fair-lending',
              s: 'Quarterly disparate-impact + equalised-odds review.',
            },
            {
              i: <BankIcon size={18} />,
              t: 'Bank-partner',
              s: 'Lender-of-record carried structurally on every Loan.',
            },
          ].map((c) => (
            <div key={c.t}>
              <span
                className="inline-flex size-10 rounded-xl items-center justify-center"
                style={{ background: '#eef2ff', color: '#1e3a8a' }}
              >
                {c.i}
              </span>
              <h3 className="mt-3 text-[14px] font-bold text-[#0d1530]">{c.t}</h3>
              <p className="mt-1 text-[12px] text-gray-600 leading-relaxed max-w-xs mx-auto">
                {c.s}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#0d1530] text-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-[18px] font-bold tracking-tight">EazePay</div>
            <p className="text-[12px] text-white/55 mt-1 max-w-md">
              Multi-brand orchestration, payments, and merchant operating system. White-glove
              funding solutions that put your financial success first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="h-10 px-4 rounded-lg bg-white text-[#0d1530] font-semibold text-[13px] inline-flex items-center gap-2"
            >
              Developer docs
              <ArrowRightIcon size={13} />
            </Link>
            <a
              href="mailto:partners@eazepay.com"
              className="h-10 px-4 rounded-lg border border-white/20 text-white font-semibold text-[13px] inline-flex items-center"
            >
              partners@eazepay.com
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
