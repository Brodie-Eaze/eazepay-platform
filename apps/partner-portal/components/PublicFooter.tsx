import Link from 'next/link';

/**
 * Public footer rendered on the trust-signal pages (status, security
 * overview, changelog, api-docs) and on the master Shell. Surfaces the
 * four trust pages plus a row of subtle compliance badges — text-only,
 * no icons, copy is honest ("in progress", not "certified").
 *
 * Token classes only (no inline styles, no hardcoded hex). The badges
 * sit at the same visual weight as the existing per-vertical chrome so
 * they read as platform-level signal rather than marketing fluff.
 */

const TRUST_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/status', label: 'Status' },
  { href: '/security-overview', label: 'Security' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/api-docs', label: 'API docs' },
];

const SECONDARY_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/help', label: 'Help' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
];

const COMPLIANCE_BADGES: ReadonlyArray<string> = [
  'SOC 2 in progress',
  '256-bit TLS',
  'FCRA + Reg B compliant',
  'PCI scope minimized',
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-bg-elevated/60 mt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Trust signals"
          className="flex items-center gap-3 text-[12px] text-fg-secondary"
        >
          {TRUST_LINKS.map((link, idx) => (
            <span key={link.href} className="flex items-center gap-3">
              <Link href={link.href} className="hover:text-fg transition-colors">
                {link.label}
              </Link>
              {idx < TRUST_LINKS.length - 1 && (
                <span aria-hidden className="text-border">
                  ·
                </span>
              )}
            </span>
          ))}
          <span aria-hidden className="text-border">
            |
          </span>
          {SECONDARY_LINKS.map((link, idx) => (
            <span key={link.href} className="flex items-center gap-3">
              <Link href={link.href} className="text-fg-muted hover:text-fg transition-colors">
                {link.label}
              </Link>
              {idx < SECONDARY_LINKS.length - 1 && (
                <span aria-hidden className="text-border">
                  ·
                </span>
              )}
            </span>
          ))}
        </nav>
        <ul className="flex flex-wrap items-center gap-2" aria-label="Compliance posture">
          {COMPLIANCE_BADGES.map((badge) => (
            <li
              key={badge}
              className="rounded-full border border-border bg-bg-muted/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
            >
              {badge}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
