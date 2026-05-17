import Link from 'next/link';
import { CheckIcon, BoltIcon } from '@eazepay/ui/web';

/**
 * Welcome → submitted. Confirmation screen after the wizard is sent
 * to the backend. Tells the partner what to expect next (KYB, owner
 * IDV via email, signing the merchant agreement).
 */
export default function OnboardingSubmittedPage() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href="/sign-in" className="flex items-center gap-2.5">
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
          Application received
        </h1>
        <p className="mt-3 text-[14px] text-fg-secondary leading-relaxed">
          Thanks for signing up. Our KYB team is reviewing your business now. You'll receive an
          email within one business day either confirming approval or asking for one more piece of
          info.
        </p>

        <ol className="mt-8 text-left space-y-3 rounded-xl border border-border bg-bg-elevated p-5">
          {[
            {
              t: 'KYB verification',
              d: 'IRS EIN match, Secretary-of-State good standing, OFAC + PEP screen.',
            },
            {
              t: 'Owner identity check',
              d: 'Each beneficial owner gets a secure link to verify their ID.',
            },
            {
              t: 'Merchant agreement',
              d: 'A countersigned PDF lands in your inbox once owners verify.',
            },
            {
              t: 'You go live',
              d: 'Bank account verified via Plaid Auth, processor MID provisioned, branded checkout enabled.',
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

        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center mt-8 h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] hover:bg-[#1a2a52]"
        >
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
