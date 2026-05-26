/**
 * /admin — EazePay admin landing
 *
 * Index page for every admin surface. Drives the demo walkthrough:
 * lender toggle, MedPay vertical config, audit log, observability,
 * provisioning queue, customer migration queue.
 *
 * Refactored 2026-05 to mirror /control-panel: PageHeader + PageBody
 * + Card-based tile grid + token classes. Zero inline styles.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  StatusPill,
  ArrowRightIcon,
  QueueIcon,
  DocIcon,
  SettingsIcon,
  GaugeIcon,
  BoltIcon,
  BankIcon,
  HeartPulseIcon,
  type StatusTone,
} from '@eazepay/ui/web';

type Tile = {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  badge?: { label: string; tone: StatusTone };
};

const TILES: Tile[] = [
  {
    href: '/control-panel',
    title: 'Partner roster',
    desc: 'Every partner on the platform · suspend / reactivate · per-partner drill-in.',
    icon: <SettingsIcon size={18} />,
  },
  {
    href: '/admin/verticals/medpay',
    title: 'MedPay vertical config',
    desc: 'Allowed lender set · routing policy · branding defaults · economics.',
    icon: <HeartPulseIcon size={18} />,
    badge: { label: 'Demo-critical', tone: 'accent' },
  },
  {
    href: '/lender-marketplace',
    title: 'Lender marketplace',
    desc: 'Registry · per-lender detail · per-partner access matrix.',
    icon: <BankIcon size={18} />,
  },
  {
    href: '/admin/provisioning',
    title: 'Provisioning queue',
    desc: 'One-config onboarding · HighSale + Marketplace + MiCamp per step.',
    icon: <QueueIcon size={18} />,
    badge: { label: 'Live', tone: 'success' },
  },
  {
    href: '/admin/audit',
    title: 'Audit log',
    desc: 'Every admin action across the platform · search by actor / target / time.',
    icon: <DocIcon size={18} />,
  },
  {
    href: '/admin/observability',
    title: 'Observability',
    desc: 'Engine latency · lender health · webhook delivery · queue depth.',
    icon: <GaugeIcon size={18} />,
  },
  {
    href: '/admin/migrations/ai-funding',
    title: 'AI Funding → MedPay',
    desc: 'July 1 cutover · per-customer migration status · retries.',
    icon: <BoltIcon size={18} />,
    badge: { label: 'Cutover', tone: 'warning' },
  },
];

export default function AdminIndexPage(): JSX.Element {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin' }, { label: 'Control Plane' }]}
        title="Control plane"
        description="Every operational surface on the platform. The MedPay vertical config + lender marketplace + provisioning queue tiles are the demo walk path. Audit log + observability are how we prove compliance and operational discipline to lenders during NDA review."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill tone="accent" dot>
              Platform admin
            </StatusPill>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              aria-label={`${t.title} — ${t.desc}`}
            >
              <Card className="h-full transition-colors group-hover:border-border-strong">
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="size-8 rounded-md bg-bg-muted text-fg-secondary flex items-center justify-center shrink-0"
                        aria-hidden
                      >
                        {t.icon}
                      </span>
                      <h3 className="text-[14px] font-semibold text-fg truncate">{t.title}</h3>
                    </div>
                    {t.badge && <StatusPill tone={t.badge.tone}>{t.badge.label}</StatusPill>}
                  </div>
                  <p className="text-[12.5px] text-fg-muted leading-relaxed">{t.desc}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
                    Open <ArrowRightIcon size={12} />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </PageBody>
    </>
  );
}
