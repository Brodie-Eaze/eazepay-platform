'use client';

/**
 * /admin/provisioning/new — One-config provisioning form
 *
 * The single form that kicks off the entire one-config onboarding
 * workflow. Posts to `/api/onboarding/provision`, then redirects to
 * the run detail page so operators can watch the steps complete.
 *
 * This page is the operational realization of the strategy doc's
 * "one configuration form auto-provisions HighSale + Lender
 * Marketplace + MiCamp" promise.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Input,
  Textarea,
  Select,
  Banner,
  Button as _Button,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';

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

type FormState = {
  partnerId: string;
  legalName: string;
  dba: string;
  ein: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  brand: 'medpay' | 'tradepay' | 'coachpay' | 'ai_funding';
  bureau: 'fico8' | 'vantage';
  monthlyPullCap: string;
  billingCadence: 'weekly' | 'biweekly' | 'monthly';
  estimatedAnnualVolume: string;
  estimatedTicket: string;
  mccCode: string;
  funnelUrls: string;
};

const INITIAL: FormState = {
  partnerId: '',
  legalName: '',
  dba: '',
  ein: '',
  primaryContactName: '',
  primaryContactEmail: '',
  primaryContactPhone: '',
  brand: 'medpay',
  bureau: 'fico8',
  monthlyPullCap: '500',
  billingCadence: 'weekly',
  estimatedAnnualVolume: '500000',
  estimatedTicket: '4500',
  mccCode: '8099',
  funnelUrls: '',
};

export default function NewProvisionRunPage(): JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: form.partnerId,
          legalName: form.legalName,
          dba: form.dba || null,
          ein: form.ein,
          primaryContactName: form.primaryContactName,
          primaryContactEmail: form.primaryContactEmail,
          primaryContactPhone: form.primaryContactPhone,
          brand: form.brand,
          bureau: form.bureau,
          monthlyPullCap: form.monthlyPullCap ? Number(form.monthlyPullCap) : null,
          billingCadence: form.billingCadence,
          estimatedAnnualVolumeCents: Math.round(Number(form.estimatedAnnualVolume) * 100),
          estimatedTicketCents: Math.round(Number(form.estimatedTicket) * 100),
          mccCode: form.mccCode,
          funnelUrls: form.funnelUrls
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string; title?: string };
        throw new Error(body.detail ?? body.title ?? `HTTP ${res.status}`);
      }
      const run = (await res.json()) as { id: string };
      router.push(`/admin/provisioning/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Provisioning', href: '/admin/provisioning' },
          { label: 'New run' },
        ]}
        title="New provisioning run"
        description="Submitting this form auto-provisions HighSale (sub-account) → Lender Marketplace defaults → MiCamp (MID pre-underwriting) → Partner-portal seed in a single sequence."
      />
      <PageBody>
        <form onSubmit={submit} className="grid gap-5 max-w-5xl" aria-busy={submitting}>
          <Card>
            <CardHeader title="Business" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Partner ID"
                  value={form.partnerId}
                  onChange={(e) => patch('partnerId', e.target.value)}
                  placeholder="acme-medspa"
                  required
                />
                <Input
                  label="Legal name"
                  value={form.legalName}
                  onChange={(e) => patch('legalName', e.target.value)}
                  placeholder="Acme MedSpa, LLC"
                  required
                />
                <Input
                  label="DBA (optional)"
                  value={form.dba}
                  onChange={(e) => patch('dba', e.target.value)}
                  placeholder="Acme MedSpa"
                />
                <Input
                  label="EIN"
                  value={form.ein}
                  onChange={(e) => patch('ein', e.target.value)}
                  placeholder="12-3456789"
                  required
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Primary contact" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Name"
                  value={form.primaryContactName}
                  onChange={(e) => patch('primaryContactName', e.target.value)}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.primaryContactEmail}
                  onChange={(e) => patch('primaryContactEmail', e.target.value)}
                  required
                />
                <Input
                  label="Phone"
                  value={form.primaryContactPhone}
                  onChange={(e) => patch('primaryContactPhone', e.target.value)}
                  required
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Platform setup" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select
                  label="Brand"
                  value={form.brand}
                  onChange={(e) =>
                    patch('brand', (e.target as HTMLSelectElement).value as FormState['brand'])
                  }
                  options={[
                    { value: 'medpay', label: 'MedPay' },
                    { value: 'tradepay', label: 'TradePay' },
                    { value: 'coachpay', label: 'CoachPay' },
                    { value: 'ai_funding', label: 'AI Funding' },
                  ]}
                />
                <Select
                  label="Bureau"
                  value={form.bureau}
                  onChange={(e) =>
                    patch('bureau', (e.target as HTMLSelectElement).value as FormState['bureau'])
                  }
                  options={[
                    { value: 'fico8', label: 'FICO8' },
                    { value: 'vantage', label: 'Vantage' },
                  ]}
                />
                <Input
                  label="Monthly pull cap"
                  type="number"
                  min={0}
                  value={form.monthlyPullCap}
                  onChange={(e) => patch('monthlyPullCap', e.target.value)}
                />
                <Select
                  label="Billing cadence"
                  value={form.billingCadence}
                  onChange={(e) =>
                    patch(
                      'billingCadence',
                      (e.target as HTMLSelectElement).value as FormState['billingCadence'],
                    )
                  }
                  options={[
                    { value: 'weekly', label: 'Weekly (probation)' },
                    { value: 'biweekly', label: 'Bi-weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="MiCamp risk profile" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Estimated annual volume (USD)"
                  type="number"
                  min={0}
                  value={form.estimatedAnnualVolume}
                  onChange={(e) => patch('estimatedAnnualVolume', e.target.value)}
                  required
                />
                <Input
                  label="Average ticket (USD)"
                  type="number"
                  min={0}
                  value={form.estimatedTicket}
                  onChange={(e) => patch('estimatedTicket', e.target.value)}
                  required
                />
                <Input
                  label="MCC code"
                  value={form.mccCode}
                  onChange={(e) => patch('mccCode', e.target.value)}
                  maxLength={4}
                  required
                />
              </div>
              <div className="mt-4">
                <Textarea
                  label="Funnel URLs (one per line)"
                  value={form.funnelUrls}
                  onChange={(e) => patch('funnelUrls', e.target.value)}
                  placeholder={
                    'https://acme-medspa.com/financing\nhttps://acme-medspa.com/treatments'
                  }
                  className="font-mono text-[13px]"
                />
              </div>
            </CardBody>
          </Card>

          {error && (
            <Banner intent="danger" title="Provisioning failed" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Provisioning…' : 'Kick off provisioning'}
            </Button>
            <Link
              href="/admin/provisioning"
              className="inline-flex"
              aria-label="Cancel and return to provisioning queue"
            >
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </PageBody>
    </>
  );
}
