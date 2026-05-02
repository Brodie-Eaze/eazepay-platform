import type { ReactNode } from 'react';
import Link from 'next/link';
import { lightColors, spacing } from '@eazepay/ui/tokens';

export const metadata = { title: 'EazePay Admin' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: lightColors.bgMuted,
          color: lightColors.textPrimary,
          fontFamily: 'Inter, -apple-system, sans-serif',
          display: 'flex',
          minHeight: '100vh',
        }}
      >
        <aside
          style={{
            width: 240,
            backgroundColor: lightColors.bgInverse,
            color: lightColors.textInverse,
            padding: spacing.xl,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: spacing.xxl }}>
            EazePay <span style={{ color: lightColors.dangerFg }}>Admin</span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <NavLink href="/" label="Queue" />
            <NavLink href="/risk-flags" label="Risk flags" />
            <NavLink href="/compliance-reviews" label="Compliance reviews" />
            <NavLink href="/audit-logs" label="Audit logs" />
            <NavLink href="/lenders" label="Lenders" />
          </nav>
          <div style={{ marginTop: spacing.giant, padding: spacing.md, backgroundColor: '#1f2937', borderRadius: 8, fontSize: 12, lineHeight: 1.4 }}>
            <strong>Reminder:</strong> JIT PII access is logged on every read.
            Decline overrides ≥ $25k require dual control.
          </div>
        </aside>
        <main style={{ flex: 1, padding: spacing.xxl }}>{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        color: lightColors.textInverse,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: 8,
        fontSize: 14,
        opacity: 0.9,
      }}
    >
      {label}
    </Link>
  );
}
