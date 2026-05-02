'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';
import { api } from '../../../lib/api.js';

interface LinkContext {
  merchantSlug: string;
  merchantLegalName: string;
  merchantDba: string | null;
  category: string | null;
  amountHintCents: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: string;
}

/**
 * Hosted apply page. Validates the merchant link via the public
 * GET /v1/application-links/:slug/:token endpoint, then walks the
 * consumer through register-or-login → submit application →
 * redirect to /me/applications/:id for the offer flow.
 *
 * Single-use redemption is the server's responsibility — re-loads
 * after a redemption surface a friendly "this link has been used"
 * message because the GET will return 409 link_already_used.
 */
export default function ApplyPage({ params }: { params: { slug: string; token: string } }) {
  const [ctx, setCtx] = useState<LinkContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/v1/application-links/${params.slug}/${params.token}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string; code?: string };
          setError(body.detail ?? body.code ?? `HTTP ${res.status}`);
          return;
        }
        setCtx((await res.json()) as LinkContext);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed to load');
      }
    })();
  }, [params.slug, params.token]);

  if (error) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: spacing.giant }}>
        <Card>
          <h2>Link unavailable</h2>
          <p style={{ color: lightColors.textSecondary }}>{error}</p>
          <p style={{ color: lightColors.textMuted, fontSize: 14 }}>
            Ask the merchant to send you a fresh link.
          </p>
        </Card>
      </main>
    );
  }

  if (!ctx) return <main style={{ padding: spacing.xxl }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: spacing.giant }}>
      <p style={{ color: lightColors.textMuted, marginBottom: spacing.sm }}>
        Application from <strong>{ctx.merchantDba ?? ctx.merchantLegalName}</strong>
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>Apply for finance</h1>
      <p style={{ color: lightColors.textSecondary, marginBottom: spacing.xl }}>
        Verify your identity and review offers in minutes. By continuing, you agree to receive
        electronic disclosures.
      </p>
      <SignInOrUp prefilledEmail={ctx.customerEmail ?? undefined} />
    </main>
  );
}

function SignInOrUp({ prefilledEmail }: { prefilledEmail?: string }) {
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // For brevity: try login first; if 401, attempt register. Real flow
      // surfaces explicit "create account" / "sign in" tabs.
      try {
        const r = await api().login({ identifier: email, password });
        if (r.mfaRequired) window.location.href = `/verify?challenge=${encodeURIComponent(r.challenge!.challengeId)}`;
      } catch {
        const r2 = await api().register({ email, password });
        window.location.href = `/verify?challenge=${encodeURIComponent(r2.challenge.challengeId)}`;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <div style={{ height: spacing.md }} />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        helper="≥12 characters with mixed case, number, symbol."
      />
      {error ? <p style={{ color: lightColors.dangerFg, marginTop: spacing.sm }}>{error}</p> : null}
      <div style={{ marginTop: spacing.lg }}>
        <Button onClick={submit} disabled={submitting} loading={submitting}>
          Continue
        </Button>
      </div>
    </Card>
  );
}
