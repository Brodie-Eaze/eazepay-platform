/**
 * /admin — EazePay admin landing
 *
 * Index page for every admin surface. Drives the demo walkthrough:
 * lender toggle, MedPay vertical config, audit log, observability,
 * provisioning queue, customer migration queue.
 */

import Link from 'next/link';

const TILES: Array<{
  href: string;
  title: string;
  desc: string;
  badge?: string;
}> = [
  {
    href: '/control-panel',
    title: 'Partner roster',
    desc: 'Every partner on the platform · suspend / reactivate · per-partner drill-in.',
  },
  {
    href: '/admin/verticals/medpay',
    title: 'MedPay vertical config',
    desc: 'Allowed lender set · routing policy · branding defaults · economics.',
    badge: 'Demo-critical',
  },
  {
    href: '/lender-marketplace',
    title: 'Lender marketplace',
    desc: 'Registry · per-lender detail · per-partner access matrix.',
  },
  {
    href: '/admin/provisioning',
    title: 'Provisioning queue',
    desc: 'One-config onboarding · HighSale + Marketplace + MiCamp per step.',
    badge: 'Live',
  },
  {
    href: '/admin/audit',
    title: 'Audit log',
    desc: 'Every admin action across the platform · search by actor / target / time.',
  },
  {
    href: '/admin/observability',
    title: 'Observability',
    desc: 'Engine latency · lender health · webhook delivery · queue depth.',
  },
  {
    href: '/admin/migrations/ai-funding',
    title: 'AI Funding → MedPay',
    desc: 'July 1 cutover · per-customer migration status · retries.',
    badge: 'Cutover',
  },
];

export default function AdminIndexPage(): JSX.Element {
  return (
    <div style={{ padding: 32, maxWidth: 1180, margin: '0 auto', color: '#e2e8f0' }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
          EAZEPAY ADMIN
        </div>
        <h1
          style={{ margin: '6px 0 8px', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          Control plane
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14.5, maxWidth: 720 }}>
          Every operational surface on the platform. The MedPay vertical config + lender marketplace
          + provisioning queue tiles are the demo walk path. Audit log + observability are how we
          prove compliance and operational discipline to lenders during NDA review.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 14,
        }}
      >
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: 'block',
              padding: 22,
              border: '1px solid #1f2937',
              borderRadius: 12,
              background: '#0f172a',
              color: 'inherit',
              textDecoration: 'none',
              transition: 'border-color 120ms ease, transform 120ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t.title}</h3>
              {t.badge && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#1e3a5f',
                    color: '#7dd3fc',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{t.desc}</p>
            <div style={{ marginTop: 12, color: '#7dd3fc', fontSize: 12 }}>Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
