'use client';
import { useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  ShieldIcon,
  CardIcon,
  PhoneIcon,
  CheckIcon,
  ArrowRightIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import type { ComponentType, SVGProps } from 'react';

type IconC = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/**
 * Per-brand integration configuration page.
 *
 * Lives at `/v/<brand>/integrations/<integration>` — eg.
 * `/v/medpay/integrations/ez-check` is the MedPay merchant's EZ Check
 * panel. A medical merchant configures EZ Check MedPay, MedPay
 * Processing, and DialerPay all from inside their own portal and
 * never sees TradePay or CoachPay variants.
 *
 * Each integration exposes:
 *   - Connection status (connected / pending / not connected)
 *   - Brand-specific configuration (key fields, routing rules)
 *   - Test + revoke actions
 *   - Recent activity + delivery stats
 *
 * Three integrations × three brands = nine surfaces, all driven from
 * one component so the UX stays consistent.
 */

type IntegrationCode = 'ez-check' | 'processing' | 'dialerpay';

interface IntegrationSpec {
  code: IntegrationCode;
  /** Eyebrow label, eg. "PRE-QUALIFICATION ENGINE". */
  eyebrow: string;
  /** Card heading — accepts a `{brand}` placeholder, eg. "Connect EZ Check {brand}". */
  title: (brandName: string) => string;
  /** Description paragraph. */
  description: (brandName: string) => string;
  /** Lucide-ish icon. */
  icon: IconC;
  /** Pill colour for the icon tile, eg. teal for ez-check. */
  accent: string;
  /** Capabilities surfaced as feature rows. */
  capabilities: { title: string; body: string }[];
  /** Fields the merchant configures. */
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'password' | 'select'; options?: string[]; help?: string }[];
  /** Headline metrics across the top. */
  metrics: { label: string; value: string }[];
  /** Footer CTA copy. */
  ctaLabel: string;
}

const INTEGRATIONS: Record<IntegrationCode, IntegrationSpec> = {
  'ez-check': {
    code: 'ez-check',
    eyebrow: 'PRE-QUALIFICATION ENGINE',
    title: (b) => `EZ Check ${b}`,
    description: (b) =>
      `Soft-pull pre-qualification for every ${b} applicant before they hit a hard pull. Drops the EZ Check widget on your booking page or sales funnel — applicants get an instant fundability tier and are routed straight to the right ${b} lender.`,
    icon: ShieldIcon,
    accent: '#12182f',
    capabilities: [
      {
        title: 'Soft credit qualification',
        body: 'Returns an applicant tier in under 10 seconds without affecting credit score.',
      },
      {
        title: 'Income capacity analysis',
        body: 'Plaid Income + cashflow signals scored against the brand affordability rule.',
      },
      {
        title: 'Auto-route to brand lenders',
        body: 'Qualified applicants are routed only to lenders enabled on your brand portal.',
      },
    ],
    fields: [
      {
        key: 'widgetDomain',
        label: 'Embed domain',
        placeholder: 'patients.yourpractice.com',
        help: 'Domain where the EZ Check widget will be embedded.',
      },
      {
        key: 'fallbackEmail',
        label: 'Notification email',
        placeholder: 'finance@yourpractice.com',
        help: 'We email this address whenever a qualified lead drops off.',
      },
      {
        key: 'minTier',
        label: 'Minimum tier to route',
        placeholder: 'Tier 3 (default)',
        type: 'select',
        options: ['Tier 1 — prime only', 'Tier 2 — prime + near-prime', 'Tier 3 — all eligible', 'Tier 4 — incl. subprime'],
      },
    ],
    metrics: [
      { label: 'Qualification time', value: '< 10 sec' },
      { label: 'Approval lift', value: '+42%' },
      { label: 'Pull type', value: 'Soft' },
    ],
    ctaLabel: 'Save and connect EZ Check',
  },
  processing: {
    code: 'processing',
    eyebrow: 'CARD ACQUIRING',
    title: (b) => `${b} Processing`,
    description: (b) =>
      `Accept card payments under the ${b} acquiring stack — deposit cards, co-pays, deductibles, and one-off charges. Tokenising PSP path keeps you on SAQ A, with same-day settlement to the bank account on file.`,
    icon: CardIcon,
    accent: '#12182f',
    capabilities: [
      {
        title: 'Tokenising checkout',
        body: 'PAN never touches your systems — Stripe / Adyen hosted fields keep you on SAQ A.',
      },
      {
        title: 'Same-day settlement',
        body: 'RTP / FedNow rail; ACH fallback. Sweep schedule configurable per merchant.',
      },
      {
        title: 'Chargeback workbench',
        body: 'Reason code library, evidence templates, and Nacha return-rate monitoring.',
      },
    ],
    fields: [
      {
        key: 'settlementAccount',
        label: 'Settlement bank account',
        placeholder: 'Verified Plaid Auth — Chase •••• 4421',
        help: 'Account funds settle to. Verified via Plaid Auth or micro-deposit.',
      },
      {
        key: 'mcc',
        label: 'Merchant category code (MCC)',
        placeholder: 'Auto-detected from KYB',
        help: 'Used for risk tier + interchange routing.',
      },
      {
        key: 'rail',
        label: 'Preferred payout rail',
        placeholder: 'RTP (default)',
        type: 'select',
        options: ['RTP — instant (recommended)', 'FedNow — instant', 'Same-day ACH', 'Next-day ACH'],
      },
    ],
    metrics: [
      { label: 'Settlement', value: 'Same-day' },
      { label: 'PCI scope', value: 'SAQ A' },
      { label: 'Decline retry', value: 'Smart' },
    ],
    ctaLabel: 'Save and connect Processing',
  },
  dialerpay: {
    code: 'dialerpay',
    eyebrow: 'PAY-BY-PHONE DIALLER',
    title: () => 'DialerPay',
    description: (b) =>
      `Outbound dialler that lets your ${b} reps take a card or ACH payment mid-call without leaving the script. PCI-DSS-compliant DTMF capture, biometric voice auth, and full call-recording lineage attached to the application.`,
    icon: PhoneIcon,
    accent: '#12182f',
    capabilities: [
      {
        title: 'DTMF card capture',
        body: 'Suppresses card-digit audio + masks the PAN from the agent — PCI compliant.',
      },
      {
        title: 'Voice auth + signature',
        body: 'Biometric voice ID + recorded ACH authorisation that survives a Reg E dispute.',
      },
      {
        title: 'CRM hand-off',
        body: 'Auto-creates the application + attaches the call recording + transcript.',
      },
    ],
    fields: [
      {
        key: 'callerId',
        label: 'Outbound caller ID',
        placeholder: '+1 (555) 0123-4567',
        help: 'Must be a Twilio-verified number. 10DLC registration required for US SMS.',
      },
      {
        key: 'crmWebhook',
        label: 'CRM hand-off webhook',
        placeholder: 'https://your-crm/webhooks/dialerpay',
        help: 'We POST signed events here when a card or ACH auth is captured.',
      },
      {
        key: 'recordingRetention',
        label: 'Recording retention',
        placeholder: '7 years (default)',
        type: 'select',
        options: ['90 days', '1 year', '7 years (default — FCRA/BSA)', 'Forever'],
      },
    ],
    metrics: [
      { label: 'Avg call handle', value: '< 4 min' },
      { label: 'PCI capture', value: 'DTMF mask' },
      { label: 'Disposition rate', value: '+38%' },
    ],
    ctaLabel: 'Save and connect DialerPay',
  },
};

export default function BrandIntegrationConfigPage() {
  const { brand: brandSlug, integration } = useParams<{ brand: string; integration: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const spec = INTEGRATIONS[integration as IntegrationCode];
  if (!spec) notFound();

  const brandName = BRANDS[brand!].name;
  const Icon = spec.icon;

  // Local-state-only form. In production this PATCHes
  // /v1/merchants/:id/integrations/:code with the partner-scoped JWT
  // and the BFF rotates the actual provider credentials behind it.
  const [values, setValues] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState(false);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master', href: `/v/${brandSlug}` },
          { label: brandName, href: `/v/${brandSlug}` },
          { label: 'Integrations' },
          { label: spec.title(brandName) },
        ]}
        title={spec.title(brandName)}
        description={spec.description(brandName)}
        actions={
          <StatusPill tone={connected ? 'success' : 'neutral'} dot>
            {connected ? 'Connected' : 'Not connected'}
          </StatusPill>
        }
      />

      <PageBody>
        {/* ── eyebrow + icon tile ── */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="size-12 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: `${spec.accent}1a`, color: spec.accent }}
          >
            <Icon size={22} />
          </span>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-fg-muted">
              {spec.eyebrow}
            </p>
            <p className="text-[13px] text-fg-secondary">
              Configured inside your <span className="font-semibold">{brandName} portal</span> — never
              leaks to other verticals.
            </p>
          </div>
          <Link
            href={`/v/${brandSlug}/integrations/ez-check`}
            className="text-[12px] text-fg-muted hover:text-fg flex items-center gap-1"
          >
            Other integrations <ArrowRightIcon size={12} />
          </Link>
        </div>

        {/* ── metrics ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {spec.metrics.map((m) => (
            <Card key={m.label}>
              <CardBody className="py-3 px-4">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                  {m.label}
                </p>
                <p className="text-[20px] font-semibold tracking-tight text-fg mt-1">{m.value}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── left: capabilities ── */}
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardBody>
                <h2 className="text-[14px] font-semibold text-fg mb-3">Capabilities</h2>
                <ul className="space-y-3">
                  {spec.capabilities.map((c) => (
                    <li key={c.title} className="flex gap-3">
                      <span
                        className="size-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${spec.accent}1a`, color: spec.accent }}
                      >
                        <CheckIcon size={14} />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-fg">{c.title}</p>
                        <p className="text-[12px] text-fg-muted leading-snug">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-[14px] font-semibold text-fg mb-3">
                  Configure {spec.title(brandName)}
                </h2>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConnected(true);
                  }}
                >
                  {spec.fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-[11px] font-semibold text-fg-secondary mb-1">
                        {f.label}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                          value={values[f.key] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          }
                        >
                          <option value="" disabled>
                            {f.placeholder}
                          </option>
                          {(f.options ?? []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type ?? 'text'}
                          placeholder={f.placeholder}
                          className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                          value={values[f.key] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          }
                        />
                      )}
                      {f.help && (
                        <p className="text-[11px] text-fg-muted mt-1 leading-snug">{f.help}</p>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[11px] text-fg-muted">
                      Changes are sandboxed until you click <strong>Save</strong>.
                    </p>
                    <Button size="sm" type="submit">
                      {connected ? 'Update settings' : spec.ctaLabel}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>

          {/* ── right: switcher + activity ── */}
          <div className="space-y-5">
            <Card>
              <CardBody>
                <h3 className="text-[13px] font-semibold text-fg mb-2">
                  {brandName} integrations
                </h3>
                <ul className="space-y-1">
                  {(['ez-check', 'processing', 'dialerpay'] as IntegrationCode[]).map((code) => {
                    const s = INTEGRATIONS[code];
                    const ItemIcon = s.icon;
                    const active = code === spec.code;
                    return (
                      <li key={code}>
                        <Link
                          href={`/v/${brandSlug}/integrations/${code}`}
                          className={
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ' +
                            (active
                              ? 'bg-bg-muted text-fg font-semibold'
                              : 'text-fg-secondary hover:bg-bg-muted/60')
                          }
                        >
                          <span
                            className="size-5 rounded-md flex items-center justify-center"
                            style={{ background: `${s.accent}1a`, color: s.accent }}
                          >
                            <ItemIcon size={11} />
                          </span>
                          <span className="flex-1 truncate">{s.title(brandName)}</span>
                          {code === spec.code && connected && (
                            <CheckIcon size={12} className="text-fg" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-[13px] font-semibold text-fg mb-2">Recent activity</h3>
                <ul className="space-y-2 text-[12px] text-fg-secondary">
                  <li className="flex justify-between">
                    <span>Delivery rate (24h)</span>
                    <span className="font-semibold text-fg tabular-nums">99.8%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>P95 latency</span>
                    <span className="font-semibold text-fg tabular-nums">412ms</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Errors (24h)</span>
                    <span className="font-semibold text-fg tabular-nums">0</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Last sync</span>
                    <span className="font-semibold text-fg">2 min ago</span>
                  </li>
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-[13px] font-semibold text-fg mb-1.5">Brand-locked</h3>
                <p className="text-[12px] text-fg-muted leading-snug">
                  These credentials are scoped to your <strong>{brandName}</strong> portal. They
                  never sync to other vertical portals on the same parent organisation — partners
                  on TradePay, MedPay, and CoachPay each maintain their own connections.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
