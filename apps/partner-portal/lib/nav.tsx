import Link from 'next/link';
import {
  HomeIcon,
  QueueIcon,
  ChartIcon,
  PackageIcon,
  DollarIcon,
  KeyIcon,
  WebhookIcon,
  BoltIcon,
  DocIcon,
  SettingsIcon,
  type NavGroup,
} from '@eazepay/ui/web';

export const NextLink = ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

export const partnerNav: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Overview', icon: <HomeIcon /> },
      { href: '/applications', label: 'Applications', icon: <QueueIcon /> },
      { href: '/insights', label: 'Decisioning insights', icon: <ChartIcon /> },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/products', label: 'Products & eligibility', icon: <PackageIcon /> },
      { href: '/settlements', label: 'Funding & settlements', icon: <DollarIcon /> },
    ],
  },
  {
    label: 'Integration',
    items: [
      { href: '/api-keys', label: 'API keys', icon: <KeyIcon /> },
      { href: '/webhooks', label: 'Webhooks', icon: <WebhookIcon /> },
      { href: '/sandbox', label: 'Sandbox', icon: <BoltIcon /> },
      { href: '/docs', label: 'Documentation', icon: <DocIcon /> },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: <SettingsIcon /> }],
  },
];
