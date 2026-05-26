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
  LiveIndicator,
  type StatusTone,
} from '@eazepay/ui/web';
import { expandedApplications } from '../../lib/seeded-applications';
import {
  applicationsInRange,
  applicationsByStatus,
  timeRangeToWindow,
} from '../../lib/dashboard-metrics';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';

type Tile = {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  badge?: { label: string; tone: StatusTone };
  /** Live counter rendered next to title (right-aligned, small grey). */
  liveCount?: { label: string };
};

const TILES_BASE: Tile[] = [
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
  /* Live activity heartbeat — uses the deterministic seeded fixture so
   * the "X submitted in last 24h" counter reads off the same numbers the
   * other dashboards show. */
  const { fromIso, toIso } = timeRangeToWindow('7d');
  const last7d = applicationsInRange(expandedApplications, fromIso, toIso);
  const dayFrom = timeRangeToWindow('7d');
  const last24hWindow = {
    fromIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    toIso: dayFrom.toIso,
  };
  const submitted24h = applicationsInRange(
    expandedApplications,
    last24hWindow.fromIso,
    last24hWindow.toIso,
  ).filter((r) => r.status === 'submitted').length;
  const statusCounts = applicationsByStatus(last7d);
  const partnerCount = MASTER_PARTNERS.length;

  const TILES: Tile[] = TILES_BASE.map((t) => {
    if (t.href === '/control-panel') {
      return { ...t, liveCount: { label: `${partnerCount} partners` } };
    }
    if (t.href === '/admin/provisioning') {
      return { ...t, liveCount: { label: `${statusCounts.in_review} active` } };
    }
    if (t.href === '/lender-marketplace') {
      return { ...t, liveCount: { label: `${statusCounts.funded} funded · 7d` } };
    }
    if (t.href === '/admin/observability') {
      return { ...t, liveCount: { label: `${last7d.length} apps · 7d` } };
    }
    return t;
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin' }, { label: 'Control Plane' }]}
        title="Control plane"
        description="Every operational surface on the platform. The MedPay vertical config + lender marketplace + provisioning queue tiles are the demo walk path. Audit log + observability are how we prove compliance and operational discipline to lenders during NDA review."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <LiveIndicator />
            <StatusPill tone="accent" dot>
              Platform admin
            </StatusPill>
          </div>
        }
      />
      <PageBody>
        {/* Sprint H: live activity counter — drill into the submitted
            list filtered to the last 24h window. */}
        <Link
          href="/applications?status=submitted&range=24h"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-[12px] text-fg-secondary hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          aria-label={`${submitted24h} applications submitted in last 24h. Open filtered list.`}
        >
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          <span className="font-semibold text-fg tabular-nums">{submitted24h}</span>
          <span>applications submitted in last 24h</span>
          <ArrowRightIcon size={11} aria-hidden />
        </Link>
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
                      {t.liveCount && (
                        <span
                          className="text-[11px] tabular-nums text-fg-muted shrink-0"
                          aria-label={`Live: ${t.liveCount.label}`}
                        >
                          · {t.liveCount.label}
                        </span>
                      )}
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
