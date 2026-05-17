'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary.
 *
 * Replaces the root `<html>`/`<body>` when an error happens inside
 * `app/layout.tsx` itself (or any provider mounted within it). This is
 * the LAST line of defence — if this throws, the user sees the browser's
 * default plain-text error page.
 *
 * Per Next.js 14 docs this file MUST render its own `<html>` and
 * `<body>` because it replaces the root layout entirely. The styling
 * is intentionally inline + minimal: at this stage we cannot assume
 * Tailwind, fonts, or theme tokens have loaded.
 *
 * Structured breadcrumb mirrors error.tsx so future Sentry wiring sees
 * the same event shape regardless of which boundary triggered.
 */
export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'partner_portal.global_error',
        digest: error.digest ?? null,
        msg: error.message,
        stack: error.stack ?? null,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          background: '#0d1530',
          color: '#ffffff',
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 600,
              opacity: 0.6,
              margin: '0 0 12px',
            }}
          >
            Critical error
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 12px' }}>
            EazePay couldn&apos;t start the page.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.8, margin: '0 0 20px' }}>
            The issue has been logged. Try again, or reload the browser. If it keeps happening,
            please contact support.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, opacity: 0.55, fontFamily: 'ui-monospace, monospace' }}>
              Error id: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              background: '#ffffff',
              color: '#0d1530',
              fontWeight: 600,
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
