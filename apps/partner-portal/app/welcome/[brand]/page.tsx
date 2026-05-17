'use client';
import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { csrfHeaders } from '../../../lib/client-csrf';

/**
 * /welcome/[brand] — landing page from the branded welcome email.
 *
 * Email link looks like:
 *   https://eazepay-platform-production.up.railway.app/v/medpay/welcome?u=<userId>
 *
 * The recipient sets their initial password here; on success the
 * server mints an `eazepay_account` cookie and redirects them into
 * /v/<brand>. From there they have a real session, the per-brand
 * portal renders the partner-scoped data, and they can invite
 * teammates etc.
 *
 * This page is a NAKED_ROUTE — middleware skips the auth fence for
 * /v/<brand>/welcome (added to PUBLIC_PATHS) so the recipient who
 * arrives without any cookie can reach the password form. The form
 * itself enforces userId + password validity on submit.
 *
 * UI rules:
 *   - Brand-aware accent (matches the email's accent + sidebar)
 *   - Strong password requirements visible up front, validated
 *     server-side too (Zod with the same regex set as register).
 *   - "Show password" toggle for the field to reduce typos on first
 *     password creation — the most common UX complaint in onboarding
 *     password forms.
 */
export default function WelcomePage() {
  const router = useRouter();
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const searchParams = useSearchParams();
  const userId = searchParams?.get('u') ?? '';

  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const spec = brand ? BRANDS[brand] : null;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!userId)
      return 'This link is missing the account identifier. Open the welcome email again, or contact support.';
    if (password.length < 12) return 'Password must be at least 12 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include a digit.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.';
    if (password !== confirm) return 'Passwords don’t match.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const localError = validate();
    if (localError) {
      setError(localError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({ userId, newPassword: password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          detail?: string;
          code?: string;
        };
        setError(body.detail ?? body.code ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const body = (await res.json()) as { redirectTo: string };
      router.push(body.redirectTo);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (!brand || !spec) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
        <p className="text-fg-muted text-[13px]">Unknown brand.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="w-full max-w-md">
        <div className="h-1 rounded-full mb-3" style={{ background: spec.accentHex }} />
        <div className="rounded-2xl border border-border bg-bg-elevated p-7 shadow-sm">
          <p
            className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-1"
            style={{ color: spec.accentHex }}
          >
            {spec.name}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-fg mb-1">
            Welcome to {spec.name}.
          </h1>
          <p className="text-[13px] leading-relaxed text-fg-secondary mb-5">
            Pick a password to finish setting up your portal. You&apos;ll sign in at this address
            from now on.
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-fg-secondary mb-1">
                New password
              </span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="new-password"
                  required
                  className="w-full h-10 rounded-md border border-border bg-bg px-3 pr-16 text-[13px] outline-none focus:ring-2 focus:ring-border-focus"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-fg-muted hover:text-fg px-2 py-1"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-fg-secondary mb-1">
                Confirm password
              </span>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                autoComplete="new-password"
                required
                className="w-full h-10 rounded-md border border-border bg-bg px-3 text-[13px] outline-none focus:ring-2 focus:ring-border-focus"
              />
            </label>

            <ul className="text-[11px] text-fg-muted leading-relaxed space-y-0.5 pt-1">
              <li>At least 12 characters</li>
              <li>1 uppercase · 1 lowercase · 1 digit · 1 symbol</li>
            </ul>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg text-white font-semibold text-[14px] mt-2 disabled:opacity-60"
              style={{ background: spec.accentHex }}
            >
              {submitting ? 'Setting password…' : `Enter ${spec.name} portal`}
            </button>
          </form>
        </div>
        <p className="text-[11px] text-fg-muted text-center mt-3">
          Need help? Email support@{spec.slug}.eazepay.com.
        </p>
      </div>
    </div>
  );
}
