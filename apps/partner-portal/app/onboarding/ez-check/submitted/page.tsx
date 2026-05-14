import Link from 'next/link';
import { CheckIcon, BoltIcon, ShieldIcon } from '@eazepay/ui/web';

/**
 * EZ Check install request submitted. Confirmation page after the
 * 5-step wizard is sent to the backend. The backend (HighSale) takes
 * over from here — provisioning the widget, scheduling the install
 * call, and emailing the technical contact.
 */
export default function EzCheckSubmittedPage() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href="/ez-check" className="flex items-center gap-2.5">
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
          EZ Check install request submitted
        </h1>
        <p className="mt-3 text-[14px] text-fg-secondary leading-relaxed">
          Our install team has your config. You'll get a calendar invite within an hour, and
          we'll walk you through the embed during your scheduled call.
        </p>

        <ol className="mt-8 text-left space-y-3 rounded-xl border border-border bg-bg-elevated p-5">
          {[
            {
              t: 'Calendar invite',
              d: 'A confirmed invite for your selected slot lands in your technical contact’s inbox.',
            },
            {
              t: 'Sandbox keys',
              d: 'You get sandbox API keys + a copy-paste widget snippet for staging.',
            },
            {
              t: 'Install call',
              d: 'We embed the widget on your funnel together, configure routing rules, and run a test pull.',
            },
            {
              t: 'Go live',
              d: 'Production keys swap in; the EZ Check tab in your dashboard lights up with live applicants.',
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
            href="/ez-check"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-border bg-bg-elevated text-fg font-semibold text-[14px] hover:bg-bg-muted"
          >
            <ShieldIcon size={14} />
            Back to EZ Check
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
