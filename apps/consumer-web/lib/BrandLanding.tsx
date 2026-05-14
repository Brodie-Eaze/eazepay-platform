import Link from 'next/link';
import {
  Logo,
  Button,
  Card,
  CardBody,
  StatusPill,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  BankIcon,
  ChartIcon,
  SparkIcon,
  Money,
} from '@eazepay/ui/web';
import type { BrandSpec } from '@eazepay/shared-types';

/**
 * Shared template for a branded consumer landing page (TradePay /
 * MedPay / CoachPay). Brand-specific copy is passed in via the
 * `BrandSpec` plus the optional `customizations` overrides so each
 * vertical can tell its own story without forking the layout.
 */
export function BrandLanding({
  brand,
  hero,
  useCases,
  trust,
  faq,
}: {
  brand: BrandSpec;
  hero: { eyebrow: string; title: string; titleAccent: string; subhead: string };
  useCases: Array<{ label: string; desc: string; sample: string }>;
  trust: Array<[string, string]>;
  faq: Array<{ q: string; a: string }>;
}) {
  // Inline style override so each brand surfaces its own accent.
  const accentStyle = { ['--accent' as never]: hexToRgbTuple(brand.accentHex) };

  return (
    <main className="min-h-screen bg-bg" style={accentStyle as React.CSSProperties}>
      <header className="border-b border-border bg-bg-elevated/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={28} variant="mark" />
            <span className="text-[16px] font-semibold tracking-tight">
              {brand.name}
              <span className="text-fg-muted font-normal"> by EazePay</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-[14px]">
            <Link href="#how" className="text-fg-secondary hover:text-fg">How it works</Link>
            <Link href="#for-business" className="text-fg-secondary hover:text-fg">For business</Link>
            <Link href="#faq" className="text-fg-secondary hover:text-fg">FAQ</Link>
            <Link href="/" className="text-fg-secondary hover:text-fg">EazePay home</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Sign in</Button>
            <Button size="sm" trailingIcon={<ArrowRightIcon size={14} />}>Apply now</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-accent-gradient pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24">
          <StatusPill tone="accent" icon={<SparkIcon size={12} />}>{hero.eyebrow}</StatusPill>
          <h1 className="mt-5 text-[44px] md:text-[64px] font-bold leading-[1.05] tracking-tight max-w-3xl">
            {hero.title}
            <br />
            <span className="text-accent">{hero.titleAccent}</span>
          </h1>
          <p className="mt-5 text-[18px] text-fg-secondary max-w-2xl leading-relaxed">
            {hero.subhead}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" trailingIcon={<ArrowRightIcon />}>Check my offers in 90 seconds</Button>
            <Button size="lg" variant="secondary">See how it works</Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-fg-muted">
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Soft pull · zero score impact</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Bank-backed loans · TILA-disclosed</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Same-day funding · RTP</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" />
              <Money cents={brand.envelope.sizeMin} compact noFractions /> – <Money cents={brand.envelope.sizeMax} compact noFractions />
            </span>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="how" className="border-t border-border bg-bg-elevated">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">What {brand.name} finances.</h2>
          <p className="mt-2 text-[16px] text-fg-muted max-w-2xl">
            Built around the verticals where pay-over-time is the right product, not a band-aid.
            Compare real offers from real lenders before you pick one.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {useCases.map((c) => (
              <Card key={c.label} padded>
                <h3 className="text-[18px] font-semibold">{c.label}</h3>
                <p className="mt-1 text-[13px] text-fg-muted leading-relaxed">{c.desc}</p>
                <div className="mt-4 flex items-center gap-2">
                  <StatusPill tone="accent">{c.sample}</StatusPill>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">A faster path to yes.</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: <BoltIcon size={18} />, title: 'Tell us about you', desc: 'A few minutes. We collect what every lender needs in one place.' },
              { icon: <BankIcon size={18} />, title: 'Verify safely', desc: 'Confirm identity (Persona) and income (Plaid). No score impact.' },
              { icon: <SparkIcon size={18} />, title: 'See real offers', desc: 'We route across our network and present ranked side-by-side terms.' },
              { icon: <ChartIcon size={18} />, title: 'Pay your way', desc: 'Manage payments, payoff quotes, and hardship help in one app.' },
            ].map((step, i) => (
              <div key={step.title}>
                <div className="size-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  {step.icon}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-fg-muted font-semibold">Step {i + 1}</div>
                <h3 className="mt-1 text-[17px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[13px] text-fg-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For business */}
      <section id="for-business" className="border-t border-border bg-accent-soft/40">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <StatusPill tone="accent">For {brand.name} businesses</StatusPill>
            <h2 className="mt-3 text-[32px] font-bold tracking-tight">Close more sales. Skip the chase for payment.</h2>
            <p className="mt-2 text-[15px] text-fg-muted leading-relaxed">
              Drop in {brand.name} at point of sale and your customers see real financing offers in seconds.
              You get paid in full, same-day, via RTP — no collections, no chargebacks.
            </p>
            <div className="mt-6 flex gap-3">
              <Button trailingIcon={<ArrowRightIcon size={14} />}>Sign up your business</Button>
              <Button variant="secondary">Read the integration guide</Button>
            </div>
          </div>
          <Card padded>
            <ul className="space-y-3 text-[14px]">
              {[
                'Branded apply link · QR · embeddable widget',
                'Same-day funding via RTP (ACH fallback)',
                'Real-time application status in your dashboard',
                'Webhooks for every state change',
                'TILA-compliant disclosures handled for you',
                'Compliance + audit pack delivered weekly',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckIcon size={16} className="text-success mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">Built like a bank should be.</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trust.map(([t, d]) => (
              <div key={t} className="rounded-lg border border-border bg-bg-elevated p-5">
                <ShieldIcon size={18} className="text-accent" />
                <h3 className="mt-3 text-[15px] font-semibold">{t}</h3>
                <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-bg-elevated">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">Common questions.</h2>
          <div className="mt-8 space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="group rounded-lg border border-border bg-bg p-4">
                <summary className="cursor-pointer list-none flex items-center justify-between text-[15px] font-medium">
                  {q}
                  <span className="text-fg-muted group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="mt-3 text-[13px] text-fg-secondary leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg-elevated">
        <div className="max-w-6xl mx-auto px-6 py-10 text-[12px] text-fg-muted">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2"><Logo size={22} /></div>
            <div className="flex gap-6 flex-wrap">
              <Link href="#" className="hover:text-fg">Privacy notice (GLBA)</Link>
              <Link href="#" className="hover:text-fg">State privacy rights</Link>
              <Link href="#" className="hover:text-fg">Terms</Link>
              <Link href="#" className="hover:text-fg">E-SIGN consent</Link>
              <Link href="#" className="hover:text-fg">Licensing & disclosures</Link>
              <Link href="#" className="hover:text-fg">CFPB complaints</Link>
            </div>
          </div>
          <p className="mt-6 leading-relaxed max-w-4xl">
            {brand.fullName} is a marketing program operated by EazePay, Inc. Loans surfaced through
            {' '}{brand.name} are made by partner banks or state-licensed lenders, and may not be available
            in all states. APRs vary by creditworthiness and product. Soft inquiries do not affect your
            credit score; hard inquiries occur only on offer acceptance and are disclosed in your TILA box.
            © 2026 EazePay, Inc.
          </p>
        </div>
      </footer>
    </main>
  );
}

function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
