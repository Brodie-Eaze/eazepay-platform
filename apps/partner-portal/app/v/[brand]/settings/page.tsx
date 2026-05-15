'use client';
import { useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button as _Button,
  CheckIcon,
  BankIcon,
  WebhookIcon,
  ShieldIcon,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

/**
 * Brand-scoped Settings. Self-serve branding, payout bank, webhook
 * endpoints, and notification preferences. Optimistic state — backend
 * wiring lands once the partner-settings BFF route ships.
 */

export default function BrandSettingsPage() {
  const params = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === params.brand) as BrandCode | undefined;
  if (!brand) notFound();
  const brandName = BRANDS[brand!].name;

  const [biz, setBiz] = useState({
    legalName: 'Atlas Executive Coaching',
    displayName: `${brandName} merchant — Atlas Executive Coaching`,
    contactEmail: 'finance@atlascoach.io',
    contactPhone: '(212) 555-0144',
    supportUrl: 'https://atlascoach.io/financing',
  });
  const [bank, setBank] = useState({
    accountName: 'Atlas Executive Coaching LLC',
    routing: '021000021',
    account: '••••3478',
    bank: 'Cross River Bank',
    method: 'RTP' as 'RTP' | 'ACH',
  });
  const [webhook, setWebhook] = useState({
    url: 'https://hooks.atlascoach.io/eazepay',
    secret: 'whsec_atlas_••••••',
    events: {
      'application.submitted': true,
      'application.approved': true,
      'application.funded': true,
      'application.declined': true,
      'payout.scheduled': true,
      'payout.paid': false,
    },
  });
  const [notif, setNotif] = useState({
    weeklyDigest: true,
    fundingAlerts: true,
    declineAlerts: false,
  });
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: brandName, href: `/v/${params.brand}` }, { label: 'Settings' }]}
        title="Settings"
        description={`Account preferences scoped to the ${brandName} brand. Branding, payout bank, webhooks, notifications.`}
        meta={<StatusPill tone="info">{brandName}</StatusPill>}
      />
      <PageBody>
        <div className="space-y-4 max-w-4xl">
          {/* Business identity */}
          <Card>
            <CardHeader title="Business identity" description="Legal name appears on TILA disclosures and Adverse Action Notices." />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <TextRow label="Legal name" value={biz.legalName} onChange={(v) => setBiz((s) => ({ ...s, legalName: v }))} />
                <TextRow label="Display name (this brand)" value={biz.displayName} onChange={(v) => setBiz((s) => ({ ...s, displayName: v }))} />
                <TextRow label="Contact email" value={biz.contactEmail} onChange={(v) => setBiz((s) => ({ ...s, contactEmail: v }))} type="email" />
                <TextRow label="Contact phone" value={biz.contactPhone} onChange={(v) => setBiz((s) => ({ ...s, contactPhone: v }))} type="tel" />
                <TextRow label="Customer support URL" value={biz.supportUrl} onChange={(v) => setBiz((s) => ({ ...s, supportUrl: v }))} />
              </div>
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="primary" onClick={() => flash('Business identity saved')}>
                  Save identity
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Payout bank */}
          <Card>
            <CardHeader
              title="Payout bank account"
              description="Where commissions land twice a month. Bank changes are subject to dual-control approval."
              action={
                <StatusPill tone="success" dot>
                  <BankIcon size={10} /> Verified
                </StatusPill>
              }
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <TextRow label="Account holder name" value={bank.accountName} onChange={(v) => setBank((s) => ({ ...s, accountName: v }))} />
                <TextRow label="Bank" value={bank.bank} onChange={(v) => setBank((s) => ({ ...s, bank: v }))} />
                <TextRow label="Routing (ABA)" value={bank.routing} onChange={(v) => setBank((s) => ({ ...s, routing: v }))} />
                <TextRow label="Account number" value={bank.account} onChange={(v) => setBank((s) => ({ ...s, account: v }))} />
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted mb-1.5">Settlement method</p>
                <div className="flex gap-2">
                  {(['RTP', 'ACH'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBank((s) => ({ ...s, method: m }))}
                      className={
                        'h-9 px-3 rounded-md text-[12px] font-medium border ' +
                        (bank.method === m ? 'bg-fg text-white border-fg' : 'bg-bg-elevated text-fg-secondary border-border')
                      }
                    >
                      {m}
                    </button>
                  ))}
                  <span className="text-[11px] text-fg-muted self-center">
                    {bank.method === 'RTP' ? 'Real-time payments — funds in seconds' : 'Same-day ACH — funds in 4 hours'}
                  </span>
                </div>
              </div>
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="primary" onClick={() => flash('Bank change submitted for dual-control approval')}>
                  Request bank change
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Webhooks */}
          <Card>
            <CardHeader
              title="Webhook delivery"
              description={`Where ${brandName} lifecycle events ship. Brand-scoped — events from other brands you operate go to their own endpoints.`}
              action={<WebhookIcon size={14} className="text-fg-muted" />}
            />
            <CardBody>
              <TextRow label="Endpoint URL" value={webhook.url} onChange={(v) => setWebhook((s) => ({ ...s, url: v }))} />
              <TextRow label="Signing secret" value={webhook.secret} onChange={(v) => setWebhook((s) => ({ ...s, secret: v }))} />
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted mb-2">
                  Subscribed events ({Object.values(webhook.events).filter(Boolean).length} of {Object.keys(webhook.events).length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {(Object.keys(webhook.events) as Array<keyof typeof webhook.events>).map((e) => (
                    <label key={e} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhook.events[e]}
                        onChange={(ev) => setWebhook((s) => ({ ...s, events: { ...s.events, [e]: ev.target.checked } }))}
                      />
                      <span className="font-mono text-[12px] text-fg-secondary">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="secondary" onClick={() => flash('Test event delivered to endpoint')}>
                  Send test event
                </Button>
                <Button size="sm" variant="primary" onClick={() => flash('Webhook settings saved')}>
                  Save webhook
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader title="Notifications" description="Email + Slack alerts the team receives for this brand." />
            <CardBody>
              <div className="space-y-2">
                <ToggleRow label="Weekly digest" hint="Every Monday 9am AEST" value={notif.weeklyDigest} onChange={(v) => setNotif((s) => ({ ...s, weeklyDigest: v }))} />
                <ToggleRow label="Funding alerts" hint="Real-time when a deal funds" value={notif.fundingAlerts} onChange={(v) => setNotif((s) => ({ ...s, fundingAlerts: v }))} />
                <ToggleRow label="Decline alerts" hint="Aggregated daily summary of declines" value={notif.declineAlerts} onChange={(v) => setNotif((s) => ({ ...s, declineAlerts: v }))} />
              </div>
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="primary" onClick={() => flash('Notification preferences saved')}>
                  Save notifications
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Compliance summary */}
          <Card>
            <CardHeader title="Compliance summary" description="Brand-scoped attestations. Sync runs nightly against the master compliance database." />
            <CardBody>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ComplianceRow label="KYB" status="Verified" detail="re-verified 2026-01" />
                <ComplianceRow label="W-9 on file" status="Verified" detail="signed 2025-11" />
                <ComplianceRow label="State licensing" status="41 states" detail="see /legal/licenses" />
                <ComplianceRow label="Brand portal SOC 2" status="In scope" detail="report 2026-03" />
              </ul>
            </CardBody>
          </Card>
        </div>
      </PageBody>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2">
          <CheckIcon size={14} />
          {toast}
        </div>
      )}
    </>
  );
}

function TextRow({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus:border-border-strong"
      />
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-fg">{label}</p>
        <p className="text-[11px] text-fg-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={
          'relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5 ' +
          (value ? 'bg-fg' : 'bg-border')
        }
      >
        <span
          className={
            'absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transform transition ' +
            (value ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </label>
  );
}

function ComplianceRow({ label, status, detail }: { label: string; status: string; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldIcon size={12} className="text-fg-muted shrink-0" />
        <span className="text-[12px] font-medium text-fg truncate">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-[12px] font-semibold text-fg">{status}</p>
        <p className="text-[10px] text-fg-muted">{detail}</p>
      </div>
    </li>
  );
}
