'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppShell,
  Button,
  StatusPill,
  HomeIcon,
  LinkIcon,
  QueueIcon,
  DollarIcon,
  ChartIcon,
  WebhookIcon,
  KeyIcon,
  UsersIcon,
  SettingsIcon,
  type NavGroup,
} from '@eazepay/ui/web';
import { merchantOrg } from '../lib/mock-data';

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
      { href: '/links', label: 'Application links', icon: <LinkIcon /> },
      { href: '/applications', label: 'Applications', icon: <QueueIcon /> },
    ],
  },
  {
    label: 'Payments',
    items: [
      { href: '/transactions', label: 'Transactions', icon: <DollarIcon /> },
      { href: '/disputes', label: 'Disputes', icon: <DollarIcon /> },
      { href: '/settlements', label: 'Settlements', icon: <DollarIcon /> },
    ],
  },
  {
    label: 'Performance',
    items: [{ href: '/analytics', label: 'Analytics', icon: <ChartIcon /> }],
  },
  {
    label: 'Integration',
    items: [
      { href: '/api-keys', label: 'API keys', icon: <KeyIcon /> },
      { href: '/webhooks', label: 'Webhooks', icon: <WebhookIcon /> },
    ],
  },
  {
    label: 'Organization',
    items: [
      { href: '/team', label: 'Team', icon: <UsersIcon /> },
      { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  return (
    <AppShell
      product="Merchant"
      activePath={pathname}
      groups={groups}
      envLabel={{ label: 'Live', tone: 'live' }}
      LinkComponent={NextLink}
      topRight={
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" leadingIcon={<LinkIcon size={14} />}>
            New link
          </Button>
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <div className="size-7 rounded-full bg-accent text-accent-fg flex items-center justify-center text-[12px] font-semibold">
              AW
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-[12px] font-medium">{merchantOrg.contactName}</div>
              <div className="text-[11px] text-fg-muted">{merchantOrg.displayName}</div>
            </div>
          </div>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-fg-secondary uppercase tracking-wider">
            {merchantOrg.displayName}
          </div>
          <div className="leading-snug">
            KYB verified · MDR 285 bps
            <br />
            Live since{' '}
            {new Date(merchantOrg.liveSince).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
