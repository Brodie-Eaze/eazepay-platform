import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Naked-route chrome for the public trust pages. Renders a minimal top
 * bar (wordmark + sign-in CTA) and the `PublicFooter`. No AppShell,
 * no sidebar — these pages exist to be linked from Google / footer and
 * must render for an anonymous viewer.
 */
export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <header className="border-b border-border bg-bg-elevated/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[14px] font-bold tracking-tight">
            <span className="inline-block size-2 rounded-full bg-accent" aria-hidden />
            EazePay
          </Link>
          <nav className="flex items-center gap-4 text-[12px] text-fg-secondary">
            <Link href="/status" className="hover:text-fg transition-colors">
              Status
            </Link>
            <Link href="/security-overview" className="hover:text-fg transition-colors">
              Security
            </Link>
            <Link href="/changelog" className="hover:text-fg transition-colors">
              Changelog
            </Link>
            <Link href="/api-docs" className="hover:text-fg transition-colors">
              API
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-border bg-bg-muted px-3 py-1.5 text-fg font-medium hover:border-border-strong transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{children}</div>
      </main>
      {/* PublicFooter dropped per user request — top-nav links already
          expose Status / Security / Changelog / API. The duplicate at
          the bottom of every page was noise. */}
    </div>
  );
}
