import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

/** Inline glyphs so this section has no external icon dependency. */
function Glyph({ name }: { name: 'card' | 'route' | 'shield' | 'bank' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'card')
    return (
      <svg {...common} aria-hidden>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 9.5h19" />
        <path d="M6 14.5h4" />
      </svg>
    );
  if (name === 'route')
    return (
      <svg {...common} aria-hidden>
        <circle cx="5" cy="6" r="2" />
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="12" r="2" />
        <path d="M7 6h5a4 4 0 0 1 4 4v0M7 18h5a4 4 0 0 0 4-4v0" />
      </svg>
    );
  if (name === 'shield')
    return (
      <svg {...common} aria-hidden>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4.5 9.5v8M9 9.5v8M15 9.5v8M19.5 9.5v8" />
      <path d="M3 20.5h18" />
    </svg>
  );
}

const FEATURES: Array<{
  glyph: 'card' | 'route' | 'shield' | 'bank';
  title: string;
  body: string;
}> = [
  {
    glyph: 'card',
    title: 'Accept anything',
    body: 'Visa, Mastercard, Amex, Discover, ACH and digital wallets — one integration covers every rail.',
  },
  {
    glyph: 'route',
    title: 'Smart routing + failover',
    body: 'Every authorization is routed to the best-priced processor, with instant failover the moment one declines.',
  },
  {
    glyph: 'shield',
    title: 'PCI-DSS Level 1',
    body: 'Cards are tokenized at the edge and never touch your servers — vaulted, scoped, fully audited.',
  },
  {
    glyph: 'bank',
    title: 'Merchant-direct settlement',
    body: 'Funds land in the merchant account in 48–72 hours on transparent interchange-plus. No intermediary float.',
  },
];

export function Processing() {
  return (
    <section id="processing" className="bg-bg py-24">
      <Container>
        <div className="grid items-end gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <Eyebrow>Payment processing</Eyebrow>
            <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
              Every card. One rail. <span className="ez-sky-text">Settled direct.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[16px] leading-relaxed text-fg-secondary">
              EazePay is the processor beneath the brand. We take the card payment itself —
              authorize, tokenize, route and settle — so every vertical runs on the same
              processor-agnostic rail with merchant-direct payouts.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80} className="h-full">
              <div className="ez-card group flex h-full flex-col rounded-2xl border border-border bg-bg-elevated p-6">
                <span className="ez-proc-glyph grid h-11 w-11 place-items-center rounded-xl bg-brand-sky-wash text-brand-sky-deep">
                  <Glyph name={f.glyph} />
                </span>
                <div className="mt-5 text-[16px] font-bold tracking-tight text-fg">{f.title}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-fg-secondary">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="ez-proc-rail mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-bg-elevated px-6 py-4 text-[12.5px] font-medium text-fg-secondary">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
              Auth path
            </span>
            <span className="ez-proc-step">Card</span>
            <span className="ez-proc-arrow" aria-hidden />
            <span className="ez-proc-step">Tokenize</span>
            <span className="ez-proc-arrow" aria-hidden />
            <span className="ez-proc-step">Route · best processor</span>
            <span className="ez-proc-arrow" aria-hidden />
            <span className="ez-proc-step">Approve</span>
            <span className="ez-proc-arrow" aria-hidden />
            <span className="ez-proc-step ez-proc-step--win">Settle merchant-direct</span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
