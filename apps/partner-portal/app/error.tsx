'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-segment error boundary.
 *
 * Catches any unhandled exception thrown by a React Server Component
 * or client component inside the app/ tree (anywhere below this file).
 * Renders a branded fallback instead of Next.js's default exception
 * screen and emits a structured breadcrumb so future Sentry wiring has
 * something to hook into.
 *
 * Why not just rely on Next's default page:
 *   - Default is unbranded ("Application error: a client-side exception
 *     has occurred") and looks broken to a partner.
 *   - Default doesn't expose the `reset()` recover-without-reload path.
 *   - Default logs to console only — no place to wire structured
 *     telemetry without first owning this boundary.
 *
 * `global-error.tsx` (sibling file) covers the layout-level case where
 * the error happens BEFORE this segment-level boundary mounts (e.g. in
 * `app/layout.tsx`'s providers). The two together cover every render
 * path.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured breadcrumb so when Sentry lands the same shape
    // (event + digest + message) can be forwarded without rework.
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'partner_portal.route_error',
        digest: error.digest ?? null,
        msg: error.message,
        stack: error.stack ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center space-y-5">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-fg-muted">
          Something went wrong
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-fg">
          We hit an error rendering this page.
        </h1>
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          The issue has been logged. You can retry the page, head back home, or contact support if
          it keeps happening.
        </p>
        {error.digest && (
          <p className="text-[11px] text-fg-muted font-mono">Error id: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] hover:bg-[#1a2a52]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="h-10 px-4 rounded-lg border border-border bg-bg-elevated text-fg-secondary font-semibold text-[13px] hover:bg-bg-muted inline-flex items-center"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
