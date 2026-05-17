import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  ChartIcon,
  CopyIcon,
  ShieldIcon,
} from '@eazepay/ui/web';
import { SAMPLE_LENDERS, offerFor } from '../../../lib/api-v1/shared';

/**
 * Per-lender public detail page — `/lenders/[lenderId]`.
 *
 * Shows a prospective lender's view of the integration: which brands
 * they're paired with, the exact endpoint EazePay will POST to, sample
 * request + response payloads, and the webhook contract for status
 * back-flow. Pre-renders fully on the server so it's indexable +
 * shareable without auth.
 */

const fmtAmount = (cents: number) =>
  cents >= 100_000_00 ? `$${Math.round(cents / 100_000) / 10}M` : `$${Math.round(cents / 1000)}k`;

const fmtApr = (bps: { min: number; max: number }) =>
  `${(bps.min / 100).toFixed(1)}% – ${(bps.max / 100).toFixed(1)}%`;

export default function LenderDetailPage({ params }: { params: { lenderId: string } }) {
  const lender = SAMPLE_LENDERS.find((l) => l.id === params.lenderId);
  if (!lender) notFound();
  const sampleOffer = offerFor(lender!, 18_500_00, 60);

  const requestSample = JSON.stringify(
    {
      application_id: 'app_4nqLkR2vTjW',
      policy_version: 'orch_v_2026_05_a',
      snapshot_hash: 'sha256:f4e9c1a2…',
      applicant: {
        state: 'TX',
        fico_band: '740-779',
        income_monthly_cents: 684_000,
        dti_pct: 28.4,
        cashflow_score: 0.84,
        mla_covered: false,
        scra_active: false,
      },
      request: {
        amount_cents: 18_500_00,
        term_months: 60,
        category: 'home_improvement',
      },
      permissible_purpose: '604(a)(3)(A)',
    },
    null,
    2,
  );

  const responseSample = JSON.stringify(
    {
      decision: 'approved',
      offer: sampleOffer,
      reason_codes: ['approved_within_policy'],
      policy_version: 'orch_v_2026_05_a',
      valid_until: sampleOffer.valid_until,
    },
    null,
    2,
  );

  const webhookSample = JSON.stringify(
    {
      event_type: 'loan.funded',
      event_version: 1,
      occurred_at: new Date().toISOString(),
      data: {
        loan_id: 'loan_2KvN8aR',
        offer_id: sampleOffer.offer_id,
        rail: 'rtp',
        amount_cents: 18_500_00,
        disbursed_at: new Date().toISOString(),
      },
    },
    null,
    2,
  );

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link
            href="/lenders"
            className="text-[13px] font-semibold text-gray-700 hover:text-gray-900 inline-flex items-center gap-1.5"
          >
            <ArrowRightIcon size={13} className="rotate-180" /> Lender marketplace
          </Link>
          <Link
            href="/docs"
            className="text-[13px] font-semibold text-[#0d1530] hover:underline inline-flex items-center gap-1"
          >
            Full API docs <ArrowRightIcon size={12} />
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-gray-500">
          Lender adapter
        </p>
        <div className="mt-3 flex items-center gap-4">
          <span
            className="size-14 rounded-xl flex items-center justify-center font-bold text-[22px]"
            style={{ background: '#eef2ff', color: '#1e3a8a' }}
          >
            {lender!.display_name.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight text-[#0d1530] leading-none">
              {lender!.display_name}
            </h1>
            <p className="mt-1 text-[13px] text-gray-600">{lender!.legal_name}</p>
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Active on the rail
        </div>

        <dl className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Brands" value={lender!.brands.join(' · ')} />
          <Stat label="Tiers served" value={lender!.serves_tiers.join(', ')} />
          <Stat label="APR band" value={fmtApr(lender!.apr_band_bps)} />
          <Stat
            label="Envelope"
            value={`${fmtAmount(lender!.min_amount_cents)} – ${fmtAmount(lender!.max_amount_cents)}`}
          />
          <Stat label="P95 SLA" value={`${lender!.sla_p95_ms}ms`} />
          <Stat label="Integration" value={lender!.integration_type} />
          <Stat label="Webhook" value={new URL(lender!.webhook_url).host} mono />
          <Stat label="Product id" value={lender!.id} mono />
        </dl>
      </section>

      {/* ─── Endpoints reference ─── */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-gray-500">
            Endpoints
          </p>
          <h2 className="mt-2 text-[26px] font-bold tracking-tight text-[#0d1530]">
            How {lender!.display_name} plugs in
          </h2>

          <div className="mt-6 space-y-4">
            <EndpointCard
              method="POST"
              path={`/api/v1/lenders/${lender!.id}/quote`}
              summary={`EazePay POSTs the normalised applicant + bureau + bank snapshot. ${lender!.display_name}'s adapter responds with approve / decline / counter / ineligible inside its ${lender!.sla_p95_ms}ms SLA.`}
              accent="emerald"
            />
            <EndpointCard
              method="POST"
              path={`/api/v1/webhooks/lenders/${lender!.id}`}
              summary={`${lender!.display_name} posts lifecycle events back here: application.decisioned, offer.bound, loan.funded, loan.repaid, hardship.opened. HMAC-SHA256 signed.`}
              accent="emerald"
            />
            <EndpointCard
              method="GET"
              path="/api/v1/applications/{id}/offers"
              summary={`Operator console fetches the consumer-best ranked offers, including ${lender!.display_name}'s when eligible.`}
              accent="blue"
            />
          </div>
        </div>
      </section>

      {/* ─── Sample payloads ─── */}
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-gray-500">
            Request from EazePay
          </p>
          <h2 className="mt-2 text-[22px] font-bold tracking-tight text-[#0d1530]">
            What we send to your{' '}
            <code className="font-mono text-[18px] bg-gray-100 rounded px-1.5">quote</code> endpoint
          </h2>
          <CodeBlock code={requestSample} filename="request.json" />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-gray-500">
            Response shape we expect
          </p>
          <h2 className="mt-2 text-[22px] font-bold tracking-tight text-[#0d1530]">
            What {lender!.display_name} responds with
          </h2>
          <CodeBlock code={responseSample} filename="response.json" />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-gray-500">
            Inbound webhook
          </p>
          <h2 className="mt-2 text-[22px] font-bold tracking-tight text-[#0d1530]">
            Status events {lender!.display_name} posts back
          </h2>
          <CodeBlock code={webhookSample} filename="webhook.json" />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldIcon size={14} className="text-[#0d1530]" />
            <h3 className="text-[14px] font-bold text-[#0d1530]">Signing scheme</h3>
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Every payload (inbound + outbound) is signed with{' '}
            <code className="font-mono bg-gray-100 rounded px-1">
              HMAC-SHA256(secret, timestamp + '.' + nonce + '.' + body)
            </code>
            . Timestamp must be within a 5-minute window; nonce must be unique across the last 24
            hours. Failed verification returns RFC 7807{' '}
            <code className="font-mono bg-gray-100 rounded px-1">401 signature_invalid</code> with a
            human-readable <code className="font-mono bg-gray-100 rounded px-1">detail</code>.
          </p>
        </div>
      </section>

      <section className="bg-[#0d1530] text-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold">
              Next step
            </p>
            <h3 className="mt-1 text-[22px] font-bold tracking-tight">
              Ready to bind {lender!.display_name} to your sandbox?
            </h3>
            <p className="mt-1 text-[13px] text-white/65 max-w-xl">
              Generate sandbox keys, paste your webhook URL, and run the full test pack — quote,
              bind, fund, webhook back — in under 30 minutes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="h-11 px-5 rounded-lg bg-white text-[#0d1530] font-semibold text-[14px] inline-flex items-center gap-2"
            >
              Read the integration guide
              <ArrowRightIcon size={13} />
            </Link>
            <a
              href="mailto:partners@eazepay.com"
              className="h-11 px-5 rounded-lg border border-white/20 text-white font-semibold text-[14px] inline-flex items-center"
            >
              Email partners@
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gray-500">
        {label}
      </div>
      <div
        className={
          'mt-1.5 text-[13px] text-[#0d1530] font-semibold ' + (mono ? 'font-mono text-[12px]' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  summary,
  accent,
}: {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  accent: 'emerald' | 'blue';
}) {
  const tone = accent === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span
          className={'text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 ' + tone}
        >
          {method}
        </span>
        <code className="font-mono text-[13px] text-[#0d1530]">{path}</code>
        <button
          type="button"
          className="ml-auto text-[11px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          <CopyIcon size={11} /> copy
        </button>
      </div>
      <p className="mt-3 text-[13px] text-gray-700 leading-relaxed">{summary}</p>
    </div>
  );
}

function CodeBlock({ code, filename }: { code: string; filename: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-gray-800 bg-gray-900 text-gray-100 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="font-mono text-[11px] text-gray-400">{filename}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">JSON</span>
      </div>
      <pre className="font-mono text-[12px] leading-relaxed p-4 overflow-x-auto">{code}</pre>
    </div>
  );
}
