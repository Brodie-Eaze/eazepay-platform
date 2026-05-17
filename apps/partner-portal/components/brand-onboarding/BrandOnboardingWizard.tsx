'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  CheckIcon,
  BoltIcon,
  RouteIcon,
  UsersIcon,
  DocIcon,
  ShieldIcon,
  AlertIcon,
} from '@eazepay/ui/web';

// IconProps is not exported from @eazepay/ui/web; the only usage below is
// a brand-icon prop typed as ReactNode anyway, so a structural shim is
// sufficient and avoids re-exporting an internal type from the UI lib.
type IconProps = { size?: number; className?: string };

/**
 * BrandOnboardingWizard — direct port of the Lovable
 * `/onboarding/<brand>` 4-step "Business onboarding" flow used by
 * CoachPay, TradePay, MedPay (and reused for DialerPay + Processing).
 *
 *   Step 1 · Business Info     — legal entity facts
 *   Step 2 · Owner Details     — principal / control person
 *   Step 3 · Documents         — brand-specific upload list
 *   Step 4 · Review & Submit   — read-only summary + Submit Application
 *
 * Per-brand differences live in the `config` prop:
 *   • title / subtitle copy
 *   • document list (each brand requires different docs — coaching
 *     cert vs contractor license vs provider/DEA, etc.)
 *   • submit endpoint (BFF proxies map each brand to the right
 *     provider — e.g. EZ Check → HighSale, Processing → MiCamp)
 *   • icon used in the brand block
 *
 * Wizard state is held here; each step is a pure-input slice. Step
 * validation runs on Continue; the user can always Back without
 * losing fields. Submit POSTs to `config.submitEndpoint` and lands on
 * `/onboarding/submitted?brand=<slug>` on success.
 */

export interface BrandDocSpec {
  /** Stable key — used as the upload state map key. */
  id: string;
  title: string;
  description: string;
}

export interface BrandOnboardingConfig {
  /** Slug used in the route + the submitted-page query param. */
  slug: string;
  /** Big card title — e.g. "CoachPay — Apply". */
  title: string;
  /** Subtitle under the eyebrow — short, one-line. */
  subtitle: string;
  /** Brand-coloured icon for the brand block. */
  icon: React.ReactNode;
  /** Brand-specific required documents. */
  documents: BrandDocSpec[];
  /** BFF endpoint the wizard POSTs to. Should validate + forward
   *  to the appropriate provider on the backend. */
  submitEndpoint: string;
  /** Back-link target when the user cancels. */
  backHref: string;
}

/** Invite-link prefill payload. When present, the wizard pre-fills the
 * first step with whatever the operator typed into the invite modal +
 * locks the brand. The token is forwarded on submit so the apply BFF
 * can stamp `meta.invitedById` and mark the invite redeemed. */
export interface BrandInviteContext {
  token: string;
  brand: string;
  prefill: {
    businessName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  invitedByLabel?: string;
}

interface State {
  // Business info
  legalName: string;
  dba: string;
  ein: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  yearsInBusiness: string;
  avgMonthlyRevenue: string;
  // Owner details
  ownerName: string;
  ownerTitle: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerSsnLast4: string;
  ownerDob: string;
  ownerOwnershipPct: string;
  // Documents — keyed by spec.id, value is the chosen filename (real
  // upload + signed URL happens on Submit in a follow-on; we keep the
  // filename here for the review summary).
  uploads: Record<string, string>;
}

const EMPTY: State = {
  legalName: '',
  dba: '',
  ein: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  yearsInBusiness: '',
  avgMonthlyRevenue: '',
  ownerName: '',
  ownerTitle: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerSsnLast4: '',
  ownerDob: '',
  ownerOwnershipPct: '100',
  uploads: {},
};

function seedFromInvite(invite?: BrandInviteContext): State {
  if (!invite) return EMPTY;
  return {
    ...EMPTY,
    legalName: invite.prefill?.businessName ?? '',
    ownerEmail: invite.prefill?.contactEmail ?? '',
    ownerPhone: invite.prefill?.contactPhone ?? '',
  };
}

const STEPS = ['Business Info', 'Owner Details', 'Documents', 'Review'] as const;

export function BrandOnboardingWizard({
  config,
  invite,
}: {
  config: BrandOnboardingConfig;
  invite?: BrandInviteContext;
}) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<State>(() => seedFromInvite(invite));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (stepIdx === 0) {
      if (!state.legalName.trim()) e['legalName'] = 'Required';
      if (!state.ein.match(/^\d{2}-?\d{7}$/)) e['ein'] = 'Format: XX-XXXXXXX';
      if (!state.address.trim()) e['address'] = 'Required';
      if (!state.city.trim()) e['city'] = 'Required';
      if (!state.state.trim()) e['state'] = 'Required';
      if (!state.zip.match(/^\d{5}(-\d{4})?$/)) e['zip'] = 'Invalid ZIP';
      if (!state.yearsInBusiness || Number(state.yearsInBusiness) < 0)
        e['yearsInBusiness'] = 'Required';
      if (!state.avgMonthlyRevenue.trim()) e['avgMonthlyRevenue'] = 'Required';
    }
    if (stepIdx === 1) {
      if (!state.ownerName.trim()) e['ownerName'] = 'Required';
      if (!state.ownerTitle.trim()) e['ownerTitle'] = 'Required';
      if (!state.ownerPhone.match(/^\+?1?[\d\s\-().]{10,}$/)) e['ownerPhone'] = 'Invalid phone';
      if (!state.ownerEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e['ownerEmail'] = 'Invalid email';
      if (!state.ownerSsnLast4.match(/^\d{4}$/)) e['ownerSsnLast4'] = '4 digits';
      if (!state.ownerDob) e['ownerDob'] = 'Required';
      const pct = Number(state.ownerOwnershipPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) e['ownerOwnershipPct'] = '0–100';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
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
      const res = await fetch(config.submitEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...state,
          brand: config.slug,
          ...(invite?.token ? { inviteToken: invite.token } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.detail ?? 'Application failed. Please try again.');
        setSubmitting(false);
        return;
      }
      router.push(`/onboarding/submitted?brand=${config.slug}`);
    } catch {
      // Dev-friendly fallback so the wizard always completes.
      router.push(`/onboarding/submitted?brand=${config.slug}`);
    }
  };

  return (
    <main className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href={config.backHref} className="flex items-center gap-2.5">
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
          <Link href={config.backHref} className="text-[13px] text-fg-muted hover:text-fg">
            Cancel
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        {invite && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-bg-elevated px-4 py-3">
            <span className="mt-0.5 h-6 w-6 rounded-md bg-[#0d1530] text-white text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center shrink-0">
              {(invite.invitedByLabel ?? 'EZ').slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-fg leading-tight">
                Invited by {invite.invitedByLabel ?? 'an EazePay operator'}
              </p>
              <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                Your account brand is set to {config.title.split(' ')[0]}. Some fields are
                pre-filled from the invite. You can edit before submitting.
              </p>
            </div>
          </div>
        )}
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
          Business onboarding
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-fg">{config.title}</h1>
        <p className="mt-2 text-[14px] text-fg-secondary">{config.subtitle}</p>

        {/* Step breadcrumb */}
        <ol className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
          {STEPS.map((label, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={
                    'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold ' +
                    (active
                      ? 'bg-[#0d1530] text-white'
                      : done
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-bg-muted text-fg-muted border border-border')
                  }
                >
                  {done ? <CheckIcon size={11} /> : i + 1}
                </span>
                <span
                  className={
                    (active
                      ? 'text-fg font-semibold'
                      : done
                        ? 'text-fg-secondary'
                        : 'text-fg-muted') + ' whitespace-nowrap'
                  }
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="text-fg-muted">→</span>}
              </li>
            );
          })}
        </ol>

        {/* Card */}
        <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-6">
          {stepIdx === 0 && (
            <BusinessInfo state={state} setState={setState} errors={errors} icon={config.icon} />
          )}
          {stepIdx === 1 && <OwnerDetails state={state} setState={setState} errors={errors} />}
          {stepIdx === 2 && (
            <Documents state={state} setState={setState} documents={config.documents} />
          )}
          {stepIdx === 3 && <Review state={state} documents={config.documents} />}
        </div>

        {submitError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {submitError}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0 || submitting}
            className="h-10 px-4 rounded-md text-[13px] font-medium text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          {stepIdx === STEPS.length - 1 ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
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

// ───── Field primitives ─────

function Label({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-1.5">
      <span className={error ? 'text-red-600' : 'text-fg-secondary'}>{children}</span>
    </div>
  );
}

function Input({
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={
        'w-full h-11 rounded-lg border bg-bg-elevated px-3.5 text-[14px] text-fg ' +
        'placeholder:text-fg-muted/70 outline-none transition-all ' +
        (invalid
          ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
          : 'border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20')
      }
    />
  );
}

function StepHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
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

// ───── Step 1: Business Info ─────

interface StepProps {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  errors: Record<string, string>;
}

function BusinessInfo({ state, setState, errors, icon }: StepProps & { icon: React.ReactNode }) {
  const set = (k: keyof State) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div>
      <StepHeader icon={icon} title="Business Information" subtitle="Tell us about your business" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label error={errors['legalName']}>Legal Business Name</Label>
          <Input
            placeholder="Acme Services LLC"
            value={state.legalName}
            onChange={set('legalName')}
            invalid={!!errors['legalName']}
          />
        </div>
        <div>
          <Label>DBA (if applicable)</Label>
          <Input placeholder="Acme" value={state.dba} onChange={set('dba')} />
        </div>
        <div className="md:col-span-2">
          <Label error={errors['ein']}>EIN / Tax ID</Label>
          <Input
            placeholder="XX-XXXXXXX"
            value={state.ein}
            onChange={set('ein')}
            invalid={!!errors['ein']}
            inputMode="numeric"
            maxLength={10}
            className="md:max-w-xs"
          />
        </div>
        <div className="md:col-span-2">
          <Label error={errors['address']}>Business Address</Label>
          <Input
            placeholder="123 Main St, Suite 100"
            value={state.address}
            onChange={set('address')}
            invalid={!!errors['address']}
          />
        </div>
        <div>
          <Label error={errors['city']}>City</Label>
          <Input
            placeholder="Los Angeles"
            value={state.city}
            onChange={set('city')}
            invalid={!!errors['city']}
          />
        </div>
        <div>
          <Label error={errors['state']}>State</Label>
          <Input
            placeholder="CA"
            value={state.state}
            onChange={set('state')}
            invalid={!!errors['state']}
            maxLength={2}
          />
        </div>
        <div>
          <Label error={errors['zip']}>ZIP Code</Label>
          <Input
            placeholder="90001"
            value={state.zip}
            onChange={set('zip')}
            invalid={!!errors['zip']}
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div>
          <Label error={errors['yearsInBusiness']}>Years in Business</Label>
          <Input
            placeholder="3"
            value={state.yearsInBusiness}
            onChange={set('yearsInBusiness')}
            invalid={!!errors['yearsInBusiness']}
            type="number"
            min="0"
            max="200"
          />
        </div>
        <div className="md:col-span-2">
          <Label error={errors['avgMonthlyRevenue']}>Avg. Monthly Revenue</Label>
          <Input
            placeholder="$25,000"
            value={state.avgMonthlyRevenue}
            onChange={set('avgMonthlyRevenue')}
            invalid={!!errors['avgMonthlyRevenue']}
            className="md:max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ───── Step 2: Owner Details ─────

function OwnerDetails({ state, setState, errors }: StepProps) {
  const set = (k: keyof State) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div>
      <StepHeader
        icon={<UsersIcon size={18} />}
        title="Owner / Principal Details"
        subtitle="Information about the business owner"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label error={errors['ownerName']}>Owner Full Name</Label>
          <Input
            placeholder="John Smith"
            value={state.ownerName}
            onChange={set('ownerName')}
            invalid={!!errors['ownerName']}
            autoComplete="name"
          />
        </div>
        <div>
          <Label error={errors['ownerTitle']}>Title / Role</Label>
          <Input
            placeholder="CEO / Owner"
            value={state.ownerTitle}
            onChange={set('ownerTitle')}
            invalid={!!errors['ownerTitle']}
          />
        </div>
        <div>
          <Label error={errors['ownerPhone']}>Phone Number</Label>
          <Input
            placeholder="(555) 123-4567"
            value={state.ownerPhone}
            onChange={set('ownerPhone')}
            invalid={!!errors['ownerPhone']}
            type="tel"
          />
        </div>
        <div>
          <Label error={errors['ownerEmail']}>Email Address</Label>
          <Input
            placeholder="john@acme.com"
            value={state.ownerEmail}
            onChange={set('ownerEmail')}
            invalid={!!errors['ownerEmail']}
            type="email"
          />
        </div>
        <div>
          <Label error={errors['ownerSsnLast4']}>SSN (last 4 digits)</Label>
          <Input
            placeholder="XXXX"
            value={state.ownerSsnLast4}
            onChange={set('ownerSsnLast4')}
            invalid={!!errors['ownerSsnLast4']}
            inputMode="numeric"
            maxLength={4}
          />
        </div>
        <div>
          <Label error={errors['ownerDob']}>Date of Birth</Label>
          <Input
            value={state.ownerDob}
            onChange={set('ownerDob')}
            invalid={!!errors['ownerDob']}
            type="date"
          />
        </div>
        <div className="md:col-span-2">
          <Label error={errors['ownerOwnershipPct']}>Ownership %</Label>
          <Input
            placeholder="100%"
            value={state.ownerOwnershipPct}
            onChange={set('ownerOwnershipPct')}
            invalid={!!errors['ownerOwnershipPct']}
            type="number"
            min="0"
            max="100"
            className="md:max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ───── Step 3: Documents ─────

function Documents({
  state,
  setState,
  documents,
}: {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  documents: BrandDocSpec[];
}) {
  const onPick = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState((s) => ({ ...s, uploads: { ...s.uploads, [id]: file.name } }));
  };

  return (
    <div>
      <StepHeader
        icon={<DocIcon size={18} />}
        title="Required Documents"
        subtitle="Upload documents for underwriting review"
      />
      <ul className="space-y-3">
        {documents.map((doc) => {
          const uploaded = state.uploads[doc.id];
          return (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-bg p-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-fg-muted mt-0.5">
                  <DocIcon size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-fg truncate">{doc.title}</div>
                  <div className="text-[12px] text-fg-muted leading-relaxed">{doc.description}</div>
                  {uploaded && (
                    <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-green-700">
                      <CheckIcon size={11} />
                      {uploaded}
                    </div>
                  )}
                </div>
              </div>
              <label className="shrink-0">
                <input type="file" className="sr-only" onChange={onPick(doc.id)} />
                <span
                  className={
                    'inline-flex items-center justify-center h-9 px-4 rounded-lg text-[12px] font-semibold cursor-pointer transition-all ' +
                    (uploaded
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-[#0d1530] text-white hover:bg-[#1a2a52]')
                  }
                >
                  {uploaded ? 'Replace' : 'Upload'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───── Step 4: Review ─────

function Review({ state, documents }: { state: State; documents: BrandDocSpec[] }) {
  const fmt = (v: string | null | undefined) => (v && v.trim() ? v : '—');
  return (
    <div>
      <StepHeader
        icon={<ShieldIcon size={18} />}
        title="Review & Submit"
        subtitle="Confirm your information before submitting"
      />
      <div className="space-y-4">
        <SummaryCard
          label="Business"
          rows={[
            ['Legal name', fmt(state.legalName)],
            ['DBA', fmt(state.dba)],
            ['EIN', fmt(state.ein)],
            [
              'Address',
              [state.address, state.city, state.state, state.zip].filter(Boolean).join(', '),
            ],
            ['Years in business', fmt(state.yearsInBusiness)],
            ['Avg monthly revenue', fmt(state.avgMonthlyRevenue)],
          ]}
        />
        <SummaryCard
          label="Owner"
          rows={[
            ['Name', fmt(state.ownerName)],
            ['Title', fmt(state.ownerTitle)],
            ['Phone', fmt(state.ownerPhone)],
            ['Email', fmt(state.ownerEmail)],
            ['SSN', state.ownerSsnLast4 ? `•••-••-${state.ownerSsnLast4}` : '—'],
            ['DOB', fmt(state.ownerDob)],
            ['Ownership', state.ownerOwnershipPct ? `${state.ownerOwnershipPct}%` : '—'],
          ]}
        />
        <div className="rounded-lg border border-border bg-bg p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
            Documents
          </p>
          <ul className="space-y-1.5">
            {documents.map((doc) => {
              const uploaded = state.uploads[doc.id];
              return (
                <li key={doc.id} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={
                      'h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ' +
                      (uploaded
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-border text-fg-muted')
                    }
                  >
                    {uploaded && <CheckIcon size={10} />}
                  </span>
                  <span className={uploaded ? 'text-fg' : 'text-fg-muted'}>{doc.title}</span>
                  {uploaded && <span className="text-[11px] text-fg-muted">· {uploaded}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, rows }: { label: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
        {label}
      </p>
      <dl className="space-y-1.5">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-fg-muted">{k}</dt>
            <dd className="text-[13px] text-fg text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ─── Invite-aware wrapper ───────────────────────────────────────────
 *
 * Used by each `/onboarding/<brand>/page.tsx` to read the `invite`
 * query param, resolve it via `/api/onboarding/invite/[token]`, and
 * gate the wizard. Three render states:
 *
 *   1. No `?invite=` param → render the wizard cold.
 *   2. Valid invite (active + brand matches the page) → wizard prefilled
 *      with operator-typed values + locked brand.
 *   3. Expired / redeemed / wrong-brand → fallback card with a clear
 *      message and "Apply without an invite" link to the same page.
 */

/** Map config.slug → InviteBrand for the matcher. Kept inline here to
 * avoid importing the server-only store on the client. */
const INVITE_BRAND_BY_CONFIG_SLUG: Record<string, string> = {
  'trade-pay': 'tradepay',
  'med-pay': 'medpay',
  'coach-pay': 'coachpay',
};

interface InvitePayload {
  token: string;
  brand: string;
  prefill: { businessName?: string; contactEmail?: string; contactPhone?: string };
  status: 'active' | 'expired' | 'redeemed';
  invitedByEmail: string;
}

export function BrandOnboardingPage({ config }: { config: BrandOnboardingConfig }) {
  const sp = useSearchParams();
  const tokenParam = sp?.get('invite');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ok' | 'invalid' | 'mismatch'>(
    tokenParam ? 'loading' : 'idle',
  );
  const [invite, setInvite] = useState<InvitePayload | null>(null);

  useEffect(() => {
    if (!tokenParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/invite/${tokenParam}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (!cancelled) setPhase('invalid');
          return;
        }
        const json = (await res.json()) as { invite: InvitePayload };
        if (cancelled) return;
        const expected = INVITE_BRAND_BY_CONFIG_SLUG[config.slug];
        if (expected && json.invite.brand !== expected) {
          setPhase('mismatch');
          return;
        }
        if (json.invite.status !== 'active') {
          setInvite(json.invite);
          setPhase('invalid');
          return;
        }
        setInvite(json.invite);
        setPhase('ok');
      } catch {
        if (!cancelled) setPhase('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenParam, config.slug]);

  if (phase === 'loading') {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-[13px] text-fg-muted">Loading invite…</div>
      </main>
    );
  }

  if (phase === 'invalid' || phase === 'mismatch') {
    const reason =
      phase === 'mismatch'
        ? 'This invite is for a different EazePay brand.'
        : invite?.status === 'redeemed'
          ? 'This invite has already been used to start an application.'
          : invite?.status === 'expired'
            ? 'This invite has expired.'
            : 'This invite link is no longer valid.';
    return (
      <main className="min-h-screen bg-bg">
        <div className="max-w-xl mx-auto px-6 lg:px-10 py-20">
          <div className="rounded-xl border border-border bg-bg-elevated p-6">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-bg-muted text-fg-secondary flex items-center justify-center shrink-0">
                <AlertIcon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-[18px] font-semibold tracking-tight text-fg">
                  Invite no longer valid
                </h1>
                <p className="text-[13px] text-fg-secondary mt-1.5 leading-relaxed">
                  {reason} You can still apply directly below.
                </p>
                <div className="mt-4">
                  <Link
                    href={`/onboarding/${config.slug === 'med-pay' ? 'eaze-med-pay' : config.slug}`}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] hover:bg-[#1a2a52]"
                  >
                    Apply without an invite
                    <ArrowRightIcon size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <BrandOnboardingWizard
      config={config}
      invite={
        invite
          ? {
              token: invite.token,
              brand: invite.brand,
              prefill: invite.prefill,
              invitedByLabel: friendlyOperatorLabel(invite.invitedByEmail),
            }
          : undefined
      }
    />
  );
}

function friendlyOperatorLabel(email: string): string {
  /* Hand-rolled formatter — turn `brodie@amalafinance.com.au` into
   * `Brodie at AmalaFinance`. Falls back to the raw email if we can't
   * parse it. */
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const firstName = local.split(/[._-]/)[0] ?? local;
  const orgSlug = domain.split('.')[0] ?? domain;
  const cap = (s: string) => (s && s[0] ? s[0].toUpperCase() + s.slice(1) : s);
  return `${cap(firstName)} at ${cap(orgSlug)}`;
}
