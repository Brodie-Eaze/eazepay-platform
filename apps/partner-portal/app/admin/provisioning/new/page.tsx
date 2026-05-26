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

const fieldStyle: React.CSSProperties = {
  background: 'rgba(2, 6, 23, 0.7)',
  border: '1px solid #1f2937',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 14,
  padding: '10px 12px',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#94a3b8',
  fontWeight: 600,
  marginBottom: 6,
  display: 'block',
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
    <div style={{ padding: 32, maxWidth: 920, margin: '0 auto', color: '#e2e8f0' }}>
      <Link
        href="/admin/provisioning"
        style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}
      >
        ← Provisioning queue
      </Link>

      <header style={{ marginTop: 16, marginBottom: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
          ONE-CONFIG ONBOARDING
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>New provisioning run</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 620 }}>
          Submitting this form auto-provisions HighSale (sub-account) → Lender Marketplace defaults
          → MiCamp (MID pre-underwriting) → Partner-portal seed in a single sequence.
        </p>
      </header>

      <form onSubmit={submit} style={{ display: 'grid', gap: 22 }}>
        <section>
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>Business</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Partner ID</label>
              <input
                style={fieldStyle}
                value={form.partnerId}
                onChange={(e) => patch('partnerId', e.target.value)}
                placeholder="acme-medspa"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Legal name</label>
              <input
                style={fieldStyle}
                value={form.legalName}
                onChange={(e) => patch('legalName', e.target.value)}
                placeholder="Acme MedSpa, LLC"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>DBA (optional)</label>
              <input
                style={fieldStyle}
                value={form.dba}
                onChange={(e) => patch('dba', e.target.value)}
                placeholder="Acme MedSpa"
              />
            </div>
            <div>
              <label style={labelStyle}>EIN</label>
              <input
                style={fieldStyle}
                value={form.ein}
                onChange={(e) => patch('ein', e.target.value)}
                placeholder="12-3456789"
                required
              />
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>Primary contact</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                style={fieldStyle}
                value={form.primaryContactName}
                onChange={(e) => patch('primaryContactName', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={fieldStyle}
                type="email"
                value={form.primaryContactEmail}
                onChange={(e) => patch('primaryContactEmail', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={fieldStyle}
                value={form.primaryContactPhone}
                onChange={(e) => patch('primaryContactPhone', e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>Platform setup</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Brand</label>
              <select
                style={fieldStyle}
                value={form.brand}
                onChange={(e) => patch('brand', e.target.value as FormState['brand'])}
              >
                <option value="medpay">MedPay</option>
                <option value="tradepay">TradePay</option>
                <option value="coachpay">CoachPay</option>
                <option value="ai_funding">AI Funding</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Bureau</label>
              <select
                style={fieldStyle}
                value={form.bureau}
                onChange={(e) => patch('bureau', e.target.value as FormState['bureau'])}
              >
                <option value="fico8">FICO8</option>
                <option value="vantage">Vantage</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Monthly pull cap</label>
              <input
                style={fieldStyle}
                type="number"
                min={0}
                value={form.monthlyPullCap}
                onChange={(e) => patch('monthlyPullCap', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Billing cadence</label>
              <select
                style={fieldStyle}
                value={form.billingCadence}
                onChange={(e) =>
                  patch('billingCadence', e.target.value as FormState['billingCadence'])
                }
              >
                <option value="weekly">Weekly (probation)</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>
            MiCamp risk profile
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Estimated annual volume (USD)</label>
              <input
                style={fieldStyle}
                type="number"
                min={0}
                value={form.estimatedAnnualVolume}
                onChange={(e) => patch('estimatedAnnualVolume', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Average ticket (USD)</label>
              <input
                style={fieldStyle}
                type="number"
                min={0}
                value={form.estimatedTicket}
                onChange={(e) => patch('estimatedTicket', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>MCC code</label>
              <input
                style={fieldStyle}
                value={form.mccCode}
                onChange={(e) => patch('mccCode', e.target.value)}
                maxLength={4}
                required
              />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Funnel URLs (one per line)</label>
            <textarea
              style={{ ...fieldStyle, fontFamily: 'monospace', fontSize: 13, minHeight: 80 }}
              value={form.funnelUrls}
              onChange={(e) => patch('funnelUrls', e.target.value)}
              placeholder={'https://acme-medspa.com/financing\nhttps://acme-medspa.com/treatments'}
            />
          </div>
        </section>

        {error && (
          <div
            style={{
              padding: 12,
              border: '1px solid #5b1e1e',
              borderRadius: 8,
              background: 'rgba(91, 30, 30, 0.20)',
              color: '#fca5a5',
              fontSize: 13.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '12px 22px',
              borderRadius: 8,
              border: '1px solid #7dd3fc',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              color: '#0c1a2e',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Provisioning…' : 'Kick off provisioning'}
          </button>
          <Link
            href="/admin/provisioning"
            style={{
              padding: '12px 22px',
              borderRadius: 8,
              border: '1px solid #334155',
              color: '#cbd5e1',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
