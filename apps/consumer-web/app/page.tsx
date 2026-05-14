import Link from 'next/link';
import {
  Button,
  Logo,
  StatusPill,
  Card,
  CardBody,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  BankIcon,
  ChartIcon,
  SparkIcon,
} from '@eazepay/ui/web';

export default function ConsumerLanding() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Top nav */}
      <header className="border-b border-border bg-bg-elevated/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">
          <Logo size={30} />
          <nav className="hidden md:flex items-center gap-7 text-[14px]">
            <Link href="#how" className="text-fg-secondary hover:text-fg">How it works</Link>
            <Link href="#for-business" className="text-fg-secondary hover:text-fg">For business</Link>
            <Link href="#legal" className="text-fg-secondary hover:text-fg">Disclosures</Link>
            <Link href="#support" className="text-fg-secondary hover:text-fg">Support</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Sign in</Button>
            <Button size="sm" trailingIcon={<ArrowRightIcon size={14} />}>Get started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-accent-gradient pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24">
          <StatusPill tone="accent" icon={<SparkIcon size={12} />}>Embedded finance for life's big purchases</StatusPill>
          <h1 className="mt-5 text-[44px] md:text-[64px] font-bold leading-[1.05] tracking-tight max-w-3xl">
            Real loan offers in <span className="text-accent">90 seconds</span>.
            <br />
            No impact to your credit to see them.
          </h1>
          <p className="mt-5 text-[18px] text-fg-secondary max-w-2xl leading-relaxed">
            EazePay routes your application across our internal lender and a network of bank-backed
            partners — so you compare real, side-by-side terms, then accept the one that's best for you.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" trailingIcon={<ArrowRightIcon />}>Apply in 90 seconds</Button>
            <Button size="lg" variant="secondary">See sample offers</Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-fg-muted">
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Soft pull only · no score impact</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Bank-backed loans · TILA-disclosed</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Funds same-day via RTP</span>
            <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> AAA-encrypted PII vault</span>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="how" className="border-t border-border bg-bg-elevated">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">Finance the things that matter.</h2>
          <p className="mt-2 text-[16px] text-fg-muted max-w-2xl">
            Built for the purchases people actually finance — and a fair compare-and-choose experience that lets the consumer drive.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Home improvement', desc: 'Solar, roof, HVAC, kitchen, bathroom.', amount: '$2k–$100k', term: '24–144 mo' },
              { label: 'Medical & dental', desc: 'Orthodontics, cosmetic, fertility, vision.', amount: '$1k–$50k', term: '12–84 mo' },
              { label: 'Auto', desc: 'New, used, and private-party purchases.', amount: '$5k–$120k', term: '24–84 mo' },
              { label: 'Consolidation', desc: 'Replace high-rate credit card debt.', amount: '$1k–$40k', term: '12–60 mo' },
              { label: 'Personal', desc: 'Weddings, moving, emergencies.', amount: '$1k–$25k', term: '12–48 mo' },
              { label: 'Retail', desc: 'High-ticket items at participating merchants.', amount: '$200–$15k', term: '3–48 mo' },
            ].map((c) => (
              <Card key={c.label} padded>
                <h3 className="text-[18px] font-semibold">{c.label}</h3>
                <p className="mt-1 text-[13px] text-fg-muted leading-relaxed">{c.desc}</p>
                <div className="mt-4 flex items-center gap-2">
                  <StatusPill tone="accent">{c.amount}</StatusPill>
                  <StatusPill tone="neutral">{c.term}</StatusPill>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">How EazePay works.</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: <BoltIcon size={18} />, title: 'Tell us about you', desc: 'A few minutes. We collect what every lender needs in one place.' },
              { icon: <BankIcon size={18} />, title: 'Verify safely', desc: 'Confirm your identity (Persona) and income (Plaid). No score impact.' },
              { icon: <SparkIcon size={18} />, title: 'See real offers', desc: 'We route across our network and present ranked side-by-side terms.' },
              { icon: <ChartIcon size={18} />, title: 'Repay your way', desc: 'Manage payments, payoff quotes, and hardship help in-app.' },
            ].map((step, i) => (
              <div key={step.title} className="relative">
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

      {/* Trust */}
      <section id="legal" className="border-t border-border bg-bg-muted/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-[32px] font-bold tracking-tight">Built like a bank should be.</h2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['SOC 2 Type II', 'Independent audit of our security posture, refreshed annually.'],
              ['Bank-partner backed', 'Loans are made by chartered partner banks under federal usury preemption.'],
              ['Encrypted PII vault', 'AES-256 with KMS envelope encryption; deterministic SIV for searchable PII.'],
              ['Adverse Action defensible', 'Every decision is reproducible to inputs + policy version, with reason codes.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border border-border bg-bg-elevated p-5">
                <ShieldIcon size={18} className="text-accent" />
                <h3 className="mt-3 text-[15px] font-semibold">{t}</h3>
                <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{d}</p>
              </div>
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
            EazePay, Inc. is a technology platform. Loans surfaced through EazePay are made by partner
            banks or licensed lenders, and may not be available in all states. APRs vary by creditworthiness
            and product. Soft inquiries do not affect your credit score; hard inquiries occur only upon
            offer acceptance and are disclosed in your TILA box. © 2026 EazePay, Inc.
          </p>
        </div>
      </footer>
    </main>
  );
}
