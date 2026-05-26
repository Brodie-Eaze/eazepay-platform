'use client';
/**
 * /applications/new — brand-selector for starting a new finance
 * application. Replaces the three sibling sidebar slots
 * (CoachPay Application · MedPay Application · TradePay Application)
 * with a single sidebar entry → one selector page → existing per-brand
 * submit forms at /submit/<brand>.
 *
 * Rationale: see docs/ia-rationalization.md — "Why collapse Submit
 * Application into a single page".
 */
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  ArrowRightIcon,
  HeartPulseIcon,
  BankIcon,
  CrownIcon,
} from '@eazepay/ui/web';
import { BRANDS, type BrandCode } from '@eazepay/shared-types';

type Choice = {
  brand: BrandCode;
  href: string;
  icon: React.ReactNode;
  blurb: string;
};

const CHOICES: Choice[] = [
  {
    brand: 'medpay',
    href: '/submit/med-pay',
    icon: <HeartPulseIcon size={20} />,
    blurb: 'Patient financing — dental, medical, vision, vet, fertility.',
  },
  {
    brand: 'tradepay',
    href: '/submit/trade-pay',
    icon: <BankIcon size={20} />,
    blurb: 'Home-improvement financing — solar, roofing, HVAC, contractor jobs.',
  },
  {
    brand: 'coachpay',
    href: '/submit/coach-pay',
    icon: <CrownIcon size={20} />,
    blurb: 'Pay-over-time for coaching, certifications, professional development.',
  },
];

export default function NewApplicationPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Applications', href: '/applications' },
          { label: 'New application' },
        ]}
        title="Start a new application"
        description="Pick the vertical that matches the client's purpose. Each brand has its own underwriting envelope and lender panel."
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-3">
          {CHOICES.map((c) => {
            const b = BRANDS[c.brand];
            return (
              <Link
                key={c.brand}
                href={c.href}
                aria-label={`Start a ${b.name} application`}
                className="block rounded-lg border border-border bg-surface hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus transition-colors"
              >
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className="inline-flex items-center justify-center size-10 rounded-md bg-bg-muted text-fg-primary"
                        aria-hidden
                      >
                        {c.icon}
                      </span>
                      <ArrowRightIcon size={16} className="text-fg-muted" />
                    </div>
                    <div className="text-[15px] font-semibold text-fg-primary mb-1">{b.name}</div>
                    <p className="text-[13px] text-fg-muted leading-snug mb-3">{c.blurb}</p>
                    <div className="text-[11px] text-fg-muted uppercase tracking-wider">
                      {b.verticals.slice(0, 3).join(' · ')}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
