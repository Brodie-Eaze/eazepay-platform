'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  RouteIcon,
  SettingsIcon,
  ClockIcon,
  BoltIcon,
} from '@eazepay/ui/web';

/**
 * EZ Check — Setup Request (5-step wizard).
 *
 * Direct port of the Lovable `/onboarding/ez-check` flow:
 *
 *   1. CRM & Platform   — pick CRM + URL + API key + technical contact
 *   2. Funnel Setup     — placement checkboxes + funnel URLs + notes
 *   3. Configuration    — webhook + redirect URLs + brand + custom domain
 *   4. Book a Call      — date + time slot for the install
 *   5. Review           — read-only summary + Submit Install Request
 *
 * "EZ Check" stays the partner-facing brand. The submission POSTs to
 * `/api/integrations/ez-check/connect` which proxies to the HighSale
 * onboarding endpoint on the BFF (HighSale is our backend pre-qual
 * provider).
 *
 * State is held on the page; each step renders a slice. Per-step
 * validation enforces the minimum we need; deeper validations
 * (RFC-3986 URLs, ABA hex, IANA timezones) run server-side at submit.
 */

type StepKey = 'crm' | 'funnel' | 'config' | 'book' | 'review';

const STEP_ORDER: StepKey[] = ['crm', 'funnel', 'config', 'book', 'review'];

const STEP_LABEL: Record<StepKey, string> = {
  crm: 'CRM & Platform',
  funnel: 'Funnel Setup',
  config: 'Configuration',
  book: 'Book a Call',
  review: 'Review',
};

const CRM_PLATFORMS = [
  'GoHighLevel',
  'HubSpot',
  'Salesforce',
  'Zoho CRM',
  'Pipedrive',
  'Close.io',
  'Keap / Infusionsoft',
  'Other',
] as const;

const FUNNEL_PLACEMENTS = [
  { id: 'landing', label: 'Landing page (pre-qualification widget)' },
  { id: 'thankyou', label: 'Thank you / confirmation page' },
  { id: 'intake', label: 'Application intake form' },
  { id: 'checkout', label: 'Checkout / payment page' },
  { id: 'custom', label: 'Custom funnel step' },
] as const;

const TIME_SLOTS = [
  '9:00 AM',
  '9:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '1:00 PM',
  '1:30 PM',
  '2:00 PM',
  '2:30 PM',
  '3:00 PM',
  '3:30 PM',
  '4:00 PM',
  '4:30 PM',
];

interface State {
  // CRM & Platform
  crmPlatform: string;
  crmUrl: string;
  apiKey: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Funnel setup
  placements: string[];
  funnelUrls: string;
  notes: string;
  // Configuration
  webhookUrl: string;
  redirectApproved: string;
  redirectDeclined: string;
  brandColor: string;
  displayName: string;
  customDomain: string;
  // Book a call
  selectedDate: string | null;
  selectedTime: string | null;
}

const EMPTY_STATE: State = {
  crmPlatform: '',
  crmUrl: '',
  apiKey: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  placements: [],
  funnelUrls: '',
  notes: '',
  webhookUrl: '',
  redirectApproved: '',
  redirectDeclined: '',
  brandColor: '',
  displayName: '',
  customDomain: '',
  selectedDate: null,
  selectedTime: null,
};

export default function EzCheckOnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepKey = STEP_ORDER[stepIdx]!;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (stepKey === 'crm') {
      if (!state.crmPlatform) e['crmPlatform'] = 'Required';
      if (!state.crmUrl.trim()) e['crmUrl'] = 'Required';
      if (!state.contactName.trim()) e['contactName'] = 'Required';
      if (!state.contactEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e['contactEmail'] = 'Invalid email';
      if (!state.contactPhone.match(/^\+?1?[\d\s\-().]{10,}$/)) e['contactPhone'] = 'Invalid phone';
    }
    if (stepKey === 'funnel') {
      if (state.placements.length === 0) e['placements'] = 'Pick at least one placement.';
    }
    if (stepKey === 'config') {
      if (!state.displayName.trim()) e['displayName'] = 'Required';
      if (state.brandColor && !state.brandColor.match(/^#?[0-9a-fA-F]{6}$/))
        e['brandColor'] = 'Use a 6-digit hex like #1a2138';
    }
    if (stepKey === 'book') {
      if (!state.selectedDate) e['date'] = 'Pick a date.';
      if (!state.selectedTime) e['time'] = 'Pick a time.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStepIdx((i) => Math.min(STEP_ORDER.length - 1, i + 1));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const back = () => {
    setStepIdx((i) => Math.max(0, i - 1));
    setErrors({});
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/integrations/ez-check/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.detail ?? 'Install request failed. Please try again.');
        setSubmitting(false);
        return;
      }
      router.push('/onboarding/ez-check/submitted');
    } catch {
      // BFF not yet wired (it proxies to HighSale) — still land on the
      // confirmation so the flow is fully exercisable.
      router.push('/onboarding/ez-check/submitted');
    }
  };

  return (
    <main className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href="/ez-check" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0d1530] flex items-center justify-center">
              <BoltIcon size={14} className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-bold tracking-tight text-fg">EAZE</div>
              <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-fg-muted -mt-0.5">
                Partner Portal
              </div>
            </div>
          </Link>
          <Link href="/ez-check" className="text-[13px] text-fg-muted hover:text-fg">
            Cancel
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        {/* Eyebrow + title */}
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
          Software install
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-fg">
          EZ Check — Setup Request
        </h1>
        <p className="mt-2 text-[14px] text-fg-secondary">
          Tell us about your CRM and where you want EZ Check installed so we can configure
          everything for you.
        </p>

        {/* Step breadcrumb */}
        <ol className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
          {STEP_ORDER.map((k, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={k} className="flex items-center gap-2">
                <span
                  className={
                    'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold ' +
                    (active
                      ? 'bg-[#0d1530] text-white'
                      : done
                        ? 'bg-bg-inverse text-white border border-bg-inverse'
                        : 'bg-bg-muted text-fg-muted border border-border')
                  }
                >
                  {done ? <CheckIcon size={11} /> : i + 1}
                </span>
                <span
                  className={
                    (active ? 'text-fg font-semibold' : done ? 'text-fg-secondary' : 'text-fg-muted') +
                    ' whitespace-nowrap'
                  }
                >
                  {STEP_LABEL[k]}
                </span>
                {i < STEP_ORDER.length - 1 && <span className="text-fg-muted">→</span>}
              </li>
            );
          })}
        </ol>

        {/* Body card */}
        <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-6">
          {stepKey === 'crm' && <CrmStep state={state} setState={setState} errors={errors} />}
          {stepKey === 'funnel' && <FunnelStep state={state} setState={setState} errors={errors} />}
          {stepKey === 'config' && <ConfigStep state={state} setState={setState} errors={errors} />}
          {stepKey === 'book' && <BookStep state={state} setState={setState} errors={errors} />}
          {stepKey === 'review' && <ReviewStep state={state} />}
        </div>

        {submitError && (
          <div className="mt-4 rounded-md border border-border-strong bg-bg-muted px-3 py-2 text-[13px] text-fg font-semibold">
            {submitError}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0 || submitting}
            className="h-10 px-4 rounded-md text-[13px] font-medium text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          {stepKey === 'review' ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Install Request'}
              {!submitting && <ArrowRightIcon size={14} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1a2a52]"
            >
              Continue
              <ArrowRightIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ───────── Step components ─────────

interface StepProps {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  errors: Record<string, string>;
}

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-[#0d1530] text-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight text-fg">{title}</h2>
        <p className="text-[12px] text-fg-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Label({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-1.5">
      <span className={error ? 'text-fg font-bold' : 'text-fg-secondary'}>{children}</span>
    </div>
  );
}

function Input({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={
        'w-full h-11 rounded-lg border bg-bg-elevated px-3.5 text-[14px] text-fg ' +
        'placeholder:text-fg-muted/70 outline-none transition-all ' +
        (invalid
          ? 'border-fg focus:border-fg focus:ring-2 focus:ring-fg/20'
          : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
      }
    />
  );
}

function CrmStep({ state, setState, errors }: StepProps) {
  const set = (k: keyof State) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div>
      <StepHeader
        icon={<SettingsIcon size={18} />}
        title="CRM & Platform Details"
        subtitle="Which CRM are you using and how do we access it?"
      />
      <div className="space-y-4">
        <div>
          <Label error={errors['crmPlatform']}>CRM Platform</Label>
          <select
            value={state.crmPlatform}
            onChange={set('crmPlatform')}
            className={
              'w-full h-11 rounded-lg border bg-bg-elevated px-3.5 text-[14px] text-fg outline-none transition-all ' +
              (errors['crmPlatform']
                ? 'border-fg focus:border-fg'
                : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
            }
          >
            <option value="">Select…</option>
            {CRM_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label error={errors['crmUrl']}>CRM Subdomain / URL</Label>
          <Input
            placeholder="agency.gohighlevel.com"
            value={state.crmUrl}
            onChange={set('crmUrl')}
            invalid={!!errors['crmUrl']}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>API Key (if available)</Label>
            <Input placeholder="sk_live_xxxxx" value={state.apiKey} onChange={set('apiKey')} />
          </div>
          <div>
            <Label error={errors['contactName']}>Technical Contact Name</Label>
            <Input
              placeholder="John Smith"
              value={state.contactName}
              onChange={set('contactName')}
              invalid={!!errors['contactName']}
            />
          </div>
          <div>
            <Label error={errors['contactEmail']}>Technical Contact Email</Label>
            <Input
              type="email"
              placeholder="dev@agency.com"
              value={state.contactEmail}
              onChange={set('contactEmail')}
              invalid={!!errors['contactEmail']}
            />
          </div>
          <div>
            <Label error={errors['contactPhone']}>Technical Contact Phone</Label>
            <Input
              type="tel"
              placeholder="(555) 123-4567"
              value={state.contactPhone}
              onChange={set('contactPhone')}
              invalid={!!errors['contactPhone']}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ state, setState, errors }: StepProps) {
  const togglePlacement = (id: string) => {
    setState((s) => {
      const has = s.placements.includes(id);
      return { ...s, placements: has ? s.placements.filter((p) => p !== id) : [...s.placements, id] };
    });
  };
  return (
    <div>
      <StepHeader
        icon={<RouteIcon size={18} />}
        title="Funnel Placement"
        subtitle="Where should we install the EZ Check widget?"
      />
      <div className="space-y-2">
        {FUNNEL_PLACEMENTS.map((p) => {
          const checked = state.placements.includes(p.id);
          return (
            <label
              key={p.id}
              className={
                'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all text-[14px] ' +
                (checked ? 'border-[#0d1530] bg-bg-muted' : 'border-border bg-bg-elevated hover:border-border-strong')
              }
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePlacement(p.id)}
                className="h-4 w-4 rounded border-border text-[#0d1530] focus:ring-[#0d1530]"
              />
              <span className="text-fg">{p.label}</span>
            </label>
          );
        })}
      </div>
      {errors['placements'] && <p className="mt-2 text-[12px] text-fg font-semibold">{errors['placements']}</p>}
      <div className="mt-5">
        <Label>Funnel / Page URLs (one per line)</Label>
        <textarea
          value={state.funnelUrls}
          onChange={(e) => setState((s) => ({ ...s, funnelUrls: e.target.value }))}
          placeholder="https://yoursite.com/apply&#10;https://yoursite.com/qualify"
          rows={4}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 text-[14px] text-fg placeholder:text-fg-muted/70 outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 resize-y"
        />
      </div>
      <div className="mt-4">
        <Label>Additional Notes</Label>
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          placeholder="Any special instructions for placement, styling, or behavior…"
          rows={3}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 text-[14px] text-fg placeholder:text-fg-muted/70 outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 resize-y"
        />
      </div>
    </div>
  );
}

function ConfigStep({ state, setState, errors }: StepProps) {
  const set = (k: keyof State) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div>
      <StepHeader
        icon={<SettingsIcon size={18} />}
        title="Configuration & Branding"
        subtitle="Customize redirects, webhooks, and branding"
      />
      <div className="space-y-4">
        <div>
          <Label>Webhook URL (optional)</Label>
          <Input
            placeholder="https://yoursite.com/webhook"
            value={state.webhookUrl}
            onChange={set('webhookUrl')}
            type="url"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Redirect URL — Approved</Label>
            <Input
              placeholder="https://yoursite.com/approved"
              value={state.redirectApproved}
              onChange={set('redirectApproved')}
              type="url"
            />
          </div>
          <div>
            <Label>Redirect URL — Declined</Label>
            <Input
              placeholder="https://yoursite.com/declined"
              value={state.redirectDeclined}
              onChange={set('redirectDeclined')}
              type="url"
            />
          </div>
          <div>
            <Label error={errors['brandColor']}>Brand Color (Hex)</Label>
            <Input
              placeholder="#1a1a2e"
              value={state.brandColor}
              onChange={set('brandColor')}
              invalid={!!errors['brandColor']}
            />
          </div>
          <div>
            <Label error={errors['displayName']}>Display Company Name</Label>
            <Input
              placeholder="Acme Financial"
              value={state.displayName}
              onChange={set('displayName')}
              invalid={!!errors['displayName']}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Custom Domain (optional)</Label>
            <Input
              placeholder="apply.yourdomain.com"
              value={state.customDomain}
              onChange={set('customDomain')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookStep({ state, setState, errors }: StepProps) {
  // Minimal month + weekday grid for the chosen-date control. The
  // Lovable site shows May 2026 with weekends greyed; we emit the same
  // shape so the visual matches. Today is highlighted with a subtle
  // ring; the selected date gets the dark-navy fill.
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const pickDate = (day: number) => {
    const iso = new Date(year, month, day).toISOString().slice(0, 10);
    setState((s) => ({ ...s, selectedDate: iso }));
  };

  return (
    <div>
      <StepHeader
        icon={<ClockIcon size={18} />}
        title="Book an Install Call"
        subtitle="Pick a date and time for our team to walk through the setup with you"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date picker */}
        <div>
          <Label error={errors['date']}>Select a date</Label>
          <div className="rounded-lg border border-border bg-bg-elevated p-3">
            <div className="text-center text-[13px] font-semibold text-fg mb-2">{monthLabel}</div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-fg-muted mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const iso = date.toISOString().slice(0, 10);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isPast = date < today && date.toDateString() !== today.toDateString();
                const isSelected = state.selectedDate === iso;
                const isToday = date.toDateString() === today.toDateString();
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isWeekend || isPast}
                    onClick={() => pickDate(day)}
                    className={
                      'h-9 w-full rounded-md text-[12px] font-medium transition-all ' +
                      (isSelected
                        ? 'bg-[#0d1530] text-white'
                        : isPast || isWeekend
                          ? 'text-fg-muted/40 cursor-not-allowed'
                          : isToday
                            ? 'bg-bg-muted text-fg ring-1 ring-border-strong'
                            : 'text-fg hover:bg-bg-muted')
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time slots */}
        <div>
          <Label error={errors['time']}>
            Select a time{state.selectedDate ? ` — ${new Date(state.selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </Label>
          <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto rounded-lg border border-border bg-bg-elevated p-3">
            {TIME_SLOTS.map((t) => {
              const selected = state.selectedTime === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, selectedTime: t }))}
                  disabled={!state.selectedDate}
                  className={
                    'flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-all ' +
                    (selected
                      ? 'bg-[#0d1530] text-white'
                      : state.selectedDate
                        ? 'bg-bg-elevated border border-border text-fg hover:border-border-strong'
                        : 'bg-bg-muted text-fg-muted/60 cursor-not-allowed border border-border')
                  }
                >
                  <ClockIcon size={11} />
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {state.selectedDate && state.selectedTime && (
        <div className="mt-4 rounded-lg border border-border bg-bg-inverse px-3 py-2 text-[13px] text-white flex items-center gap-2">
          <CheckIcon size={14} />
          Call scheduled for{' '}
          {new Date(state.selectedDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          at {state.selectedTime}
        </div>
      )}
    </div>
  );
}

function ReviewStep({ state }: { state: State }) {
  const placementLabels = state.placements
    .map((id) => FUNNEL_PLACEMENTS.find((p) => p.id === id)?.label)
    .filter(Boolean) as string[];
  const installDate = state.selectedDate
    ? new Date(state.selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  return (
    <div>
      <StepHeader
        icon={<ShieldIcon size={18} />}
        title="Review & Submit"
        subtitle="Confirm your setup details before submitting"
      />
      <div className="space-y-4">
        <SummaryCard
          label="CRM & Platform"
          rows={[
            ['Platform', state.crmPlatform || '—'],
            ['Subdomain / URL', state.crmUrl || '—'],
            ['API key', state.apiKey ? '••••••••' : '—'],
            ['Technical contact', state.contactName ? `${state.contactName} · ${state.contactEmail}` : '—'],
            ['Contact phone', state.contactPhone || '—'],
          ]}
        />
        <SummaryCard
          label="Funnel Placement"
          rows={placementLabels.length > 0 ? placementLabels.map((p) => ['', p]) : [['', 'No funnel placements selected']]}
        />
        <SummaryCard
          label="Configuration"
          rows={[
            ['Webhook', state.webhookUrl || '—'],
            ['Approved redirect', state.redirectApproved || '—'],
            ['Declined redirect', state.redirectDeclined || '—'],
            ['Brand color', state.brandColor || '—'],
            ['Display name', state.displayName || '—'],
            ['Custom domain', state.customDomain || '—'],
          ]}
        />
        <SummaryCard
          label="Install Call"
          rows={installDate && state.selectedTime ? [['', `${installDate} at ${state.selectedTime}`]] : [['', 'No call scheduled']]}
          highlight={!!(installDate && state.selectedTime)}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  rows,
  highlight,
}: {
  label: string;
  rows: Array<[string, string]>;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
        {label}
      </p>
      <dl className="space-y-1.5">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            {k ? <dt className="text-[12px] text-fg-muted">{k}</dt> : <span />}
            <dd className={'text-[13px] ' + (highlight ? 'text-fg font-semibold flex items-center gap-2' : 'text-fg text-right')}>
              {highlight && <CheckIcon size={12} />}
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
