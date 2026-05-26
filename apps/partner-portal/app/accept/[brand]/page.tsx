'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { formatTime } from '@eazepay/shared-utils/format-time';
import { csrfHeaders } from '../../../lib/client-csrf';

/**
 * /accept/[brand] — team-invite accept landing.
 *
 * Email link looks like:
 *   https://eazepay-platform-production.up.railway.app/accept/medpay?token=<uuid>
 *
 * The teammate enters their display name + password, hits Accept, and
 * lands inside /v/<brand>/ with a real account session. The page
 * pre-loads invite metadata so the recipient sees who invited them +
 * what role they're being given before they commit.
 *
 * Public route (added to PUBLIC_PATHS in middleware) so a recipient
 * with no cookie can reach it. The /api/account/accept-invite BFF
 * enforces token validity + expiry + CSRF + rate-limit.
 */
interface InvitePreview {
  recipientEmail: string;
  role: 'Owner' | 'Admin' | 'Operator' | 'Viewer' | 'Compliance';
  inviterName: string;
  inviterNote?: string;
  status: 'active' | 'expired' | 'accepted' | 'revoked';
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? '';

  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const spec = brand ? BRANDS[brand] : null;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite preview so the teammate sees what they're accepting.
  useEffect(() => {
    if (!token || !brandSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v/${brandSlug}/team/invite`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (!cancelled) {
            setPreviewError(
              `Couldn't load invite (HTTP ${res.status}). The link may be invalid or expired.`,
            );
            setPreviewLoading(false);
          }
          return;
        }
        const body = (await res.json()) as { invites: (InvitePreview & { token: string })[] };
        const match = body.invites.find((i) => i.token === token);
        if (cancelled) return;
        if (!match) {
          setPreviewError(
            "This invite isn't visible to this brand portal. Ask the operator who sent it to re-issue.",
          );
        } else {
          setPreview(match);
        }
      } catch {
        if (!cancelled) setPreviewError('Network error loading the invite.');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, brandSlug]);

  const validate = (): string | null => {
    if (!token) return 'This link is missing the invite token. Re-open the email.';
    if (!displayName.trim()) return 'Display name is required.';
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
      const res = await fetch('/api/account/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          token,
          displayName: displayName.trim(),
          newPassword: password,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string; code?: string };
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
      <div className="min-h-screen flex items-center justify-center bg-bg px-6 py-12">
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
            Accept your {spec.name} invite
          </h1>
          {previewLoading && <p className="text-[12px] text-fg-muted">Loading invite details…</p>}
          {previewError && !previewLoading && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {previewError}
            </div>
          )}
          {preview && (
            <div className="mt-2 mb-4 rounded-md bg-bg-muted/60 border border-border px-3 py-2 text-[12px] text-fg-secondary leading-relaxed">
              <strong className="text-fg">{preview.inviterName}</strong> invited you to {spec.name}{' '}
              as <strong className="text-fg">{preview.role}</strong>.
              <br />
              Expires {formatTime(preview.expiresAt, { mode: 'date' })}.
              {preview.inviterNote && (
                <>
                  <br />
                  <em className="text-fg-muted">“{preview.inviterNote}”</em>
                </>
              )}
            </div>
          )}

          {preview && preview.status === 'active' && (
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-fg-secondary mb-1">
                  Display name
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={submitting}
                  required
                  className="w-full h-10 rounded-md border border-border bg-bg px-3 text-[13px] outline-none focus:ring-2 focus:ring-border-focus"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-semibold text-fg-secondary mb-1">
                  Password
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
                {submitting ? 'Activating…' : `Join ${spec.name}`}
              </button>
            </form>
          )}

          {preview && preview.status !== 'active' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              This invite is <strong>{preview.status}</strong>. Ask the operator who sent it to
              re-issue.
            </div>
          )}
        </div>
        <p className="text-[11px] text-fg-muted text-center mt-3">
          Need help? Email support@{spec.slug}.eazepay.com.
        </p>
      </div>
    </div>
  );
}
