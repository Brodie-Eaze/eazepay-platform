import type { ReactNode } from 'react';
import Link from 'next/link';
import { lightColors, spacing } from '@eazepay/ui/tokens';

export const metadata = { title: 'EazePay Merchant' };

export default function MerchantLayout({ children }: { children: ReactNode }) {
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
            backgroundColor: lightColors.bgDefault,
            borderRight: `1px solid ${lightColors.borderDefault}`,
            padding: spacing.xl,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: spacing.xxl }}>EazePay</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <NavLink href="/" label="Overview" />
            <NavLink href="/applications" label="Applications" />
            <NavLink href="/links" label="Application links" />
            <NavLink href="/settlements" label="Settlements" />
            <NavLink href="/webhooks" label="Webhooks" />
            <NavLink href="/team" label="Team" />
            <NavLink href="/settings" label="Settings" />
          </nav>
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
        color: lightColors.textPrimary,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: 8,
        fontSize: 14,
      }}
    >
      {label}
    </Link>
  );
}
