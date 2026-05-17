'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppShell,
  Button,
  StatusPill,
  HomeIcon,
  QueueIcon,
  ChartIcon,
  PackageIcon,
  ShieldIcon,
  FlagIcon,
  DocIcon,
  KeyIcon,
  SettingsIcon,
  type NavGroup,
} from '@eazepay/ui/web';

const NextLink = ({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

const groups: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Overview', icon: <HomeIcon /> },
      {
        href: '/queue',
        label: 'Application queue',
        icon: <QueueIcon />,
        badge: (
          <span className="text-[11px] bg-accent text-accent-fg rounded-full px-1.5 py-0.5 tabular-nums">
            47
          </span>
        ),
      },
      { href: '/lenders', label: 'Lender performance', icon: <ChartIcon /> },
      { href: '/processors', label: 'Processors', icon: <PackageIcon /> },
    ],
  },
  {
    label: 'Risk & compliance',
    items: [
      { href: '/risk', label: 'Risk flags', icon: <FlagIcon /> },
      { href: '/compliance', label: 'Compliance reviews', icon: <ShieldIcon /> },
      { href: '/pii', label: 'JIT PII unmask', icon: <KeyIcon /> },
      { href: '/audit', label: 'Audit log', icon: <DocIcon /> },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/policies', label: 'Policies & rules', icon: <PackageIcon /> },
      { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  return (
    <AppShell
      product="Admin"
      activePath={pathname}
      groups={groups}
      envLabel={{ label: 'PROD · us-east-1', tone: 'live' }}
      LinkComponent={NextLink}
      topRight={
        <div className="flex items-center gap-3">
          <StatusPill tone="warning" dot>
            1 lender degraded
          </StatusPill>
          <Button size="sm" variant="ghost">
            JIT access
          </Button>
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <div className="size-7 rounded-full bg-accent text-accent-fg flex items-center justify-center text-[12px] font-semibold">
              PV
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-[12px] font-medium">Priya Vasquez</div>
              <div className="text-[11px] text-fg-muted">Sr. Underwriter</div>
            </div>
          </div>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-fg-secondary uppercase tracking-wider">
            EazePay ops
          </div>
          <div className="leading-snug">
            JIT PII reads logged · 25-mo retention
            <br />
            Decline ≥ $25k → dual-control review
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
