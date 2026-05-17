import Link from 'next/link';

/**
 * Root 404 handler. Triggered by `notFound()` calls anywhere in the
 * tree (including the SEC-101 brand-ownership fence at
 * `app/v/[brand]/layout.tsx`) and by Next.js's automatic match-miss
 * routing.
 *
 * Branded fallback — same chrome as error.tsx but with a 404-specific
 * message and no `reset()` button (404 isn't a recoverable error,
 * unlike a render exception).
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center space-y-5">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-fg-muted">404</p>
        <h1 className="text-[22px] font-semibold tracking-tight text-fg">
          We couldn&apos;t find that page.
        </h1>
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          The link may have expired, the page may have moved, or you may not have access to it.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] hover:bg-[#1a2a52] inline-flex items-center"
          >
            Go home
          </Link>
          <Link
            href="/sign-in"
            className="h-10 px-4 rounded-lg border border-border bg-bg-elevated text-fg-secondary font-semibold text-[13px] hover:bg-bg-muted inline-flex items-center"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
