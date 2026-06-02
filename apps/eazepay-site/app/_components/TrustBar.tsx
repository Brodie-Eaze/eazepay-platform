import { TICKER, INTEGRATIONS } from '../data';
import { Container } from './primitives';
import { Reveal } from './Reveal';

export function TrustBar() {
  return (
    <section className="border-b border-border bg-bg py-14">
      <Container>
        <Reveal>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            {TICKER.map((t) => (
              <div key={t.label} className="border-l-2 border-brand-sky/30 pl-4">
                <dt className="text-[34px] font-bold leading-none tracking-tight text-fg tabular-nums">
                  {t.value}
                </dt>
                <dd className="mt-2 text-[13px] font-semibold text-fg">{t.label}</dd>
                <dd className="mt-0.5 text-[12px] text-fg-muted">{t.delta}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>

      {/* integration marquee */}
      <div className="relative mt-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />
        <div className="ez-marquee" aria-hidden>
          {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="mx-6 whitespace-nowrap font-mono text-[12px] font-medium tracking-[0.14em] text-fg-muted"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-[12px] text-fg-muted">
          Processor, bank-partner, bureau, identity and attribution rails, in one platform.
        </p>
      </div>
    </section>
  );
}
