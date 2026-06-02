import type { Metadata } from 'next';
import { SiteNav } from '../_components/SiteNav';
import { SiteFooter } from '../_components/SiteFooter';
import { Container, Eyebrow } from '../_components/primitives';
import { Check } from '../_components/icons';
import { BookForm } from './BookForm';

export const metadata: Metadata = {
  title: 'Book a call',
  description:
    'Request a call with the EazePay Inc. team. See the financial infrastructure — prequalification, agents, a lender marketplace and payment processing — behind a live brand.',
};

const POINTS = [
  'A walkthrough of the platform on your real use case',
  'A live lead routed end-to-end — prequal → marketplace → settlement',
  'Pricing, onboarding timeline and a sandbox to build against',
];

export default function BookPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-bg py-16 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            {/* copy */}
            <div>
              <Eyebrow>Talk to the team</Eyebrow>
              <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-fg sm:text-[44px]">
                Book a call with <span className="ez-sky-text">our team.</span>
              </h1>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-fg-secondary">
                Tell us what you&apos;re building and we&apos;ll show you the infrastructure behind
                it — prequalification, agents, a lender marketplace and payment processing on one
                platform. No commitment, no pressure.
              </p>
              <ul className="mt-8 space-y-3.5">
                {POINTS.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[15px] text-fg-secondary">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-sky/10 text-brand-sky">
                      <Check size={13} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-[14px] text-fg-secondary">
                Prefer email?{' '}
                <a
                  href="mailto:hello@eazepay.com"
                  className="font-semibold text-brand-sky no-underline"
                >
                  hello@eazepay.com
                </a>
              </p>
            </div>

            {/* form */}
            <BookForm />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
