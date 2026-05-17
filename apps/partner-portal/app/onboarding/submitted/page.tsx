'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckIcon, BoltIcon } from '@eazepay/ui/web';

/**
 * Brand onboarding — Submitted. Shared confirmation screen for every
 * brand product (CoachPay / TradePay / MedPay / DialerPay / Processing).
 *
 * The wizard pushes to `?brand=<slug>` so the right product name and
 * next-step copy lights up here. Provider routing on the backend is
 * already implied by the brand:
 *   • Processing → MiCamp
 *   • EZ Check   → HighSale (separate route, not this page)
 *   • Brand pay  → EAZE lender orchestration
 */

const NAMES: Record<string, { title: string; backHref: string; subtitle: string }> = {
  'coach-pay': { title: 'CoachPay', backHref: '/coach-pay', subtitle: 'coaching & consulting' },
  'trade-pay': { title: 'TradePay', backHref: '/trade-pay', subtitle: 'trade & contractor' },
  'med-pay': { title: 'MedPay', backHref: '/med-pay', subtitle: 'medical & dental patient' },
  dialerpay: { title: 'DialerPay', backHref: '/dialerpay', subtitle: 'in-call payment capture' },
  processing: { title: 'Processing', backHref: '/processing', subtitle: 'card processing' },
};

function Content() {
  const params = useSearchParams();
  const brand = params.get('brand') ?? 'coach-pay';
  const info = NAMES[brand] ?? NAMES['coach-pay']!;
  const isProcessing = brand === 'processing';
  const isDialer = brand === 'dialerpay';
  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href={info.backHref} className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0d1530] flex items-center justify-center">
              <BoltIcon size={14} className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-bold tracking-tight text-fg">EAZE</div>
              <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-fg-muted -mt-0.5">
                Partner Portal
              </div>
            </div>
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-bg-inverse text-white">
          <CheckIcon size={28} />
        </span>
        <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-fg">
          {info.title} application submitted
        </h1>
        <p className="mt-3 text-[14px] text-fg-secondary leading-relaxed">
          Thanks for applying for {info.title} {info.subtitle} financing. Our underwriting team is
          reviewing your business — you'll hear back within one business day.
        </p>

        <ol className="mt-8 text-left space-y-3 rounded-xl border border-border bg-bg-elevated p-5">
          {[
            isProcessing
              ? {
                  t: 'MiCamp underwriting',
                  d: 'MID provisioned typically within 24 business hours; you get a confirmation email with your assigned MID.',
                }
              : isDialer
                ? {
                    t: 'DialerPay technical setup',
                    d: 'We pair your agent roster + 10DLC brand with the dialer config so live payments are ready on first call.',
                  }
                : {
                    t: 'KYB + lender pre-qualification',
                    d: 'IRS EIN match, OFAC + PEP screen, business license verification. Soft pull on the principal.',
                  },
            {
              t: 'Documents reviewed',
              d: 'Each document is reviewed by our compliance team; we ping you only if something is missing.',
            },
            {
              t: 'Decision notification',
              d: 'A signed decision letter lands in your inbox + appears in your portal under All Applications.',
            },
            {
              t: 'Go live',
              d: `Your ${info.title} dashboard activates with branded checkout, settlement, and the lender mix.`,
            },
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-bg-muted text-fg-secondary text-[11px] font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <div className="text-[14px] font-semibold text-fg">{step.t}</div>
                <div className="text-[12px] text-fg-muted leading-relaxed mt-0.5">{step.d}</div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href={info.backHref}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-border bg-bg-elevated text-fg font-semibold text-[14px] hover:bg-bg-muted"
          >
            Back to {info.title}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] hover:bg-[#1a2a52]"
          >
            Command Center
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SubmittedPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
