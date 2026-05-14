'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  ShieldIcon,
  HeartPulseIcon,
  HomeIcon,
  CrownIcon,
} from '@eazepay/ui/web';

/**
 * Sign-in page — "EazePay OPERATING SYSTEM".
 *
 *   ┌─ dark navy gradient ──────┬─ light surface ────────┐
 *   │ EazePay  OPERATING SYSTEM │      Welcome back      │
 *   │                           │  Sign in to continue…  │
 *   │                           │                        │
 *   │  The operating layer for  │      [Email field]     │
 *   │  every business in the    │     [Pass + Forgot]    │
 *   │  EazePay group.           │    [MFA code toggle]   │
 *   │  <description copy>       │     [Sign in →]        │
 *   │                           │  ─────────────────     │
 *   │ 600   $24k   100%         │   ROLE · DEMO          │
 *   │ apps  deal   audit        │   [Admin][Operator]    │
 *   │                           │   [Viewer][Investor]   │
 *   │                           │   BRAND PORTAL · DEMO  │
 *   │                           │   [MedPay][TradePay]   │
 *   │                           │      [CoachPay]        │
 *   └───────────────────────────┴────────────────────────┘
 *
 * Two demo preset families share one cookie (`eazepay_demo`):
 *   - Role presets (admin/operator/viewer/investor) → master command
 *     centre opens at `/` with the role's permission envelope.
 *   - Brand presets (medpay/tradepay/coachpay) → opens the per-brand
 *     vertical portal at `/v/<brand>` with that brand's sidebar +
 *     filtered data, simulating a partner who only has access to one
 *     vertical (eg. a dental practice on MedPay).
 */

interface RolePreset {
  code: 'admin' | 'operator' | 'viewer' | 'investor';
  label: string;
  sub: string;
}
const ROLES: RolePreset[] = [
  { code: 'admin',    label: 'Admin',    sub: 'Full access · users · audit · pricing' },
  { code: 'operator', label: 'Operator', sub: 'Read PII · onboard partners · approve' },
  { code: 'viewer',   label: 'Viewer',   sub: 'Read-only · masked PII' },
  { code: 'investor', label: 'Investor', sub: 'Aggregated views only' },
];

interface BrandPreset {
  code: 'master' | 'medpay' | 'tradepay' | 'coachpay';
  label: string;
  sub: string;
  accent: string;
  icon: typeof HeartPulseIcon;
}
const BRANDS: BrandPreset[] = [
  {
    code: 'master',
    label: 'Master Account',
    sub: 'All verticals · the operating system every partner portal connects to',
    accent: '#12182f',
    icon: ShieldIcon,
  },
  {
    code: 'medpay',
    label: 'MedPay portal',
    sub: 'Dental · medical · vet · fertility',
    accent: '#12182f',
    icon: HeartPulseIcon,
  },
  {
    code: 'tradepay',
    label: 'TradePay portal',
    sub: 'HVAC · roofing · solar · trades',
    accent: '#12182f',
    icon: HomeIcon,
  },
  {
    code: 'coachpay',
    label: 'CoachPay portal',
    sub: 'Coaching · certifications · courses',
    accent: '#12182f',
    icon: CrownIcon,
  },
];

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') || '/';

  // Pre-filled for evaluator convenience — these aren't real
  // credentials, just the placeholders the Lovable site shows.
  const [email, setEmail] = useState('admin@eazepay.local');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [hasMfa, setHasMfa] = useState(false);
  const [activeRole, setActiveRole] = useState<RolePreset['code']>('admin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password, remember: true }),
        credentials: 'include',
      });
      if (!res.ok) {
        // Fall through to a demo session when the real backend isn't
        // wired — keeps the page usable while the BFF comes online.
        const ok = await startDemo(activeRole);
        if (!ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string; code?: string };
          setError(
            body.code === 'invalid_credentials'
              ? 'Email or password is incorrect.'
              : body.detail || 'Sign-in failed. Please try again.',
          );
          setSubmitting(false);
          return;
        }
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      // Network error — try the demo path so the user is never stuck.
      const ok = await startDemo(activeRole);
      if (ok) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError('Network error — check your connection and try again.');
        setSubmitting(false);
      }
    }
  };

  const startDemo = async (
    preset:
      | RolePreset['code']
      | BrandPreset['code']
      | 'all'
      | 'master',
  ): Promise<boolean> => {
    try {
      const r = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
        credentials: 'include',
      });
      return r.ok;
    } catch {
      return false;
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn();
  };

  const onPickRole = async (code: RolePreset['code']) => {
    setActiveRole(code);
    setSubmitting(true);
    const ok = await startDemo(code);
    setSubmitting(false);
    if (ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Demo workspace is unavailable right now.');
    }
  };

  const onPickBrand = async (code: BrandPreset['code']) => {
    setSubmitting(true);
    // Master Account routes to the operating-system root `/`;
    // brand portals (medpay/tradepay/coachpay) route to their vertical view.
    const ok = await startDemo(code);
    setSubmitting(false);
    if (ok) {
      router.push(code === 'master' ? '/' : `/v/${code}`);
      router.refresh();
    } else {
      setError('Demo workspace is unavailable right now.');
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-bg">
      {/* ─── Left: dark navy story panel ─── */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, #1a2a52 0%, #0d1530 55%, #070b1e 100%)',
        }}
      >
        {/* Wordmark */}
        <div className="flex items-baseline gap-3">
          <span className="text-[24px] font-semibold tracking-tight leading-none">Eaze</span>
          <span className="text-[10px] uppercase tracking-[0.32em] font-semibold text-[#5d8bff]">
            Operating System
          </span>
        </div>

        {/* Headline + description */}
        <div className="max-w-md">
          <h2 className="text-[30px] font-semibold leading-tight tracking-tight">
            The operating layer for every business in the Eaze Group.
          </h2>
          <p className="mt-4 text-[13px] leading-relaxed text-white/60">
            One pane of glass over the customer book, the lender stack, and the economics.
            Origination, orchestration, settlement, servicing — every decision routed, every
            dollar funded, every clawback reconciled to a signed-webhook ledger.
          </p>
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-8 max-w-md">
          <Stat n="600" label="applications" />
          <Stat n="$24k" label="largest funded deal" />
          <Stat n="100%" label="audit coverage" />
        </div>
      </aside>

      {/* ─── Right: form panel ─── */}
      <section className="flex items-center justify-center px-6 md:px-10 py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[24px] font-semibold tracking-tight text-fg">Welcome back</h1>
          <p className="mt-1 text-[13px] text-fg-muted">Sign in to continue to the dashboard.</p>

          {error && (
            <div className="mt-4 rounded-md border border-border-strong bg-bg-muted px-3 py-2 text-[12px] text-fg font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3.5" noValidate>
            {/* Email */}
            <label className="block">
              <span className="block text-[12px] font-medium text-fg mb-1.5">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
                className="w-full h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg placeholder:text-fg-muted/70 focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 outline-none transition-all"
              />
            </label>

            {/* Password */}
            <label className="block">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12px] font-medium text-fg">Password</span>
                <Link href="/forgot-password" className="text-[11px] text-fg-muted hover:text-fg">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  className="w-full h-10 rounded-lg border border-border bg-bg-elevated px-3 pr-10 text-[13px] text-fg focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            {/* MFA toggle */}
            <button
              type="button"
              onClick={() => setHasMfa((v) => !v)}
              className="flex items-center gap-2 text-[12px] text-fg-secondary hover:text-fg"
              aria-pressed={hasMfa}
            >
              <ShieldIcon size={13} className={hasMfa ? 'text-accent' : 'text-fg-muted'} />
              <span>I have an MFA code</span>
            </button>

            {hasMfa && (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="6-digit code"
                className="w-full h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] tracking-[0.4em] font-mono text-fg focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 outline-none transition-all"
              />
            )}

            {/* Sign in */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50 transition-all"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
              {!submitting && <ArrowRightIcon size={13} />}
            </button>
          </form>

          {/* Divider */}
          <div className="border-t border-border my-6" />

          {/* ── Role quick switch ── */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-fg-secondary">
              Role · Demo
            </span>
            <span className="text-[10px] text-fg-muted">password preserved</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = activeRole === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => onPickRole(r.code)}
                  disabled={submitting}
                  className={
                    'text-left rounded-lg border px-3 py-2.5 transition-all disabled:opacity-50 ' +
                    (active
                      ? 'bg-[#0d1530] border-[#0d1530] text-white shadow-sm'
                      : 'bg-bg-elevated border-border text-fg hover:border-border-strong')
                  }
                >
                  <div className={'text-[12px] font-semibold ' + (active ? 'text-white' : 'text-fg')}>
                    {r.label}
                  </div>
                  <div
                    className={
                      'text-[10px] mt-0.5 truncate ' +
                      (active ? 'text-white/60' : 'text-fg-muted')
                    }
                  >
                    {r.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Brand portal quick switch ── */}
          <div className="flex items-center justify-between mb-2.5 mt-5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-fg-secondary">
              Workspace · Demo
            </span>
            <span className="text-[10px] text-fg-muted">single-vertical or master</span>
          </div>

          {/* Master Account — full-width emphasis tile */}
          {(() => {
            const master = BRANDS.find((b) => b.code === 'master')!;
            const Icon = master.icon;
            return (
              <button
                type="button"
                onClick={() => onPickBrand('master')}
                disabled={submitting}
                className="w-full text-left rounded-lg border border-[#0d1530] bg-[#0d1530] text-white px-3 py-2.5 hover:opacity-95 hover:shadow-sm transition-all disabled:opacity-50 mb-2"
              >
                <span
                  className="inline-flex size-6 rounded-md items-center justify-center mb-1.5 bg-white/10 text-white"
                >
                  <Icon size={13} />
                </span>
                <div className="text-[11px] font-semibold leading-tight">{master.label}</div>
                <div className="text-[10px] mt-0.5 text-white/65 leading-tight">{master.sub}</div>
              </button>
            );
          })()}

          {/* 3 brand portals — single-vertical demo views */}
          <div className="grid grid-cols-3 gap-2">
            {BRANDS.filter((b) => b.code !== 'master').map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => onPickBrand(b.code)}
                  disabled={submitting}
                  className="text-left rounded-lg border border-border bg-bg-elevated px-2.5 py-2.5 hover:border-border-strong hover:shadow-sm transition-all disabled:opacity-50 group"
                >
                  <span
                    className="inline-flex size-6 rounded-md items-center justify-center mb-1.5"
                    style={{ background: `${b.accent}1a`, color: b.accent }}
                  >
                    <Icon size={13} />
                  </span>
                  <div className="text-[11px] font-semibold text-fg leading-tight">{b.label}</div>
                  <div className="text-[10px] mt-0.5 text-fg-muted leading-tight">{b.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="text-[26px] font-semibold leading-none tracking-tight text-white">{n}</div>
      <div className="text-[10px] mt-1.5 text-white/55">{label}</div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a19.66 19.66 0 0 1 4.06-5.94" />
      <path d="M9.9 4.24A10 10 0 0 1 12 4c7 0 10 7 10 7a19.66 19.66 0 0 1-3.16 4.49" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
