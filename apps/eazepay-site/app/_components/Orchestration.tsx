import { STITCHED, UNIFIED } from '../data';
import { Check } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

export function Orchestration() {
  return (
    <section id="platform" className="bg-bg py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>The financial infrastructure</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Every brand. Every transaction. <span className="ez-sky-text">One platform.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            EazePay is the infrastructure. MedPay, TradePay, CoachPay and VetPay are brand wrappers
            on top of it. Underneath, one platform carries prequalification, the agents, a lender
            marketplace and payment processing. Stand up a new brand in days, the infrastructure
            beneath is already live, audited and in production.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* the old way */}
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-bg-elevated p-7">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                <span className="h-2 w-2 rounded-full bg-fg-muted/60" aria-hidden />
                The fragmented way
              </div>
              <p className="mt-2 text-[15px] font-medium text-fg-secondary">
                A processor here, lenders there, applications you can&apos;t track, and clients
                qualified off form questions alone.
              </p>
              <ul className="mt-6 space-y-5">
                {STITCHED.map((row) => (
                  <li key={row.stat} className="flex gap-3">
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg-muted/10 text-fg-muted"
                      aria-hidden
                    >
                      <span className="h-[2px] w-2 rounded-full bg-current" />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold leading-snug text-fg">
                        {row.stat}
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-fg-secondary">
                        {row.label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* on EazePay */}
          <Reveal delay={90}>
            <div className="relative h-full overflow-hidden rounded-2xl bg-brand-ink p-7 text-white shadow-lg">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgb(61 111 229 / 0.35), transparent 70%)',
                }}
                aria-hidden
              />
              <div className="relative flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-sky-soft">
                <span className="ez-live-dot" aria-hidden />
                On EazePay
              </div>
              <p className="relative mt-2 text-[15px] font-medium text-white/80">
                One financial infrastructure behind every brand, prequalification, agents, lenders,
                orchestration, application tracking and payments, together.
              </p>
              <ul className="relative mt-6 space-y-5">
                {UNIFIED.map((row) => (
                  <li key={row.stat} className="flex gap-3">
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-sky/15 text-brand-sky-soft"
                      aria-hidden
                    >
                      <Check size={12} />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold leading-snug text-white">
                        {row.stat}
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-white/75">
                        {row.label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
