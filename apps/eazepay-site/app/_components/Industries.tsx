import { INDUSTRIES } from '../data';
import { ArrowRight } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

export function Industries() {
  return (
    <section id="industries" className="bg-bg py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>Vertical brands on the rail</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Same rail. <span className="ez-sky-text">Different storefront.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            MedPay, TradePay and CoachPay are skinned go-to-market surfaces on the EazePay rail —
            same processor, same lender marketplace, same seven agents, same ledger. Only the brand,
            the copy and the underwriting profile change. Stand up the next vertical in days.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {INDUSTRIES.map((v, i) => (
            <Reveal key={v.name} delay={i * 90} className="h-full">
              <div className="ez-card flex h-full flex-col rounded-2xl border border-border bg-bg-elevated p-7">
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-bold tracking-tight text-fg">{v.name}</span>
                  <span className="text-[12px] font-medium text-fg-muted">
                    by Eaze<span className="text-brand-sky">Pay</span>
                  </span>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-fg-secondary">{v.desc}</p>
                <div className="mt-5 inline-flex w-fit items-center rounded-lg bg-brand-sky-wash px-3 py-1.5 font-mono text-[13px] font-bold text-brand-sky-deep">
                  {v.metric}
                </div>
                <div className="mt-auto pt-6">
                  <div className="flex flex-wrap gap-1.5">
                    {v.examples.split(' · ').map((ex) => (
                      <span
                        key={ex}
                        className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-medium text-fg-secondary"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <a
            href="#cta"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-brand-sky no-underline transition-colors hover:text-brand-sky-deep"
          >
            Launch your vertical on EazePay
            <ArrowRight size={15} />
          </a>
        </Reveal>
      </Container>
    </section>
  );
}
