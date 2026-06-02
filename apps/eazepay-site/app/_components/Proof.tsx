import { PROOF } from '../data';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

export function Proof() {
  return (
    <section className="bg-bg-muted py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>The numbers</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Built and proven <span className="ez-sky-text">in production.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p, i) => (
            <Reveal key={p.label} delay={(i % 4) * 70} className="h-full">
              <div className="h-full bg-bg-elevated p-7">
                <div className="flex items-baseline">
                  <span className="text-[44px] font-bold leading-none tracking-tight tabular-nums text-fg">
                    {p.value}
                  </span>
                  <span className="ml-0.5 text-[22px] font-bold text-brand-sky">{p.unit}</span>
                </div>
                <div className="mt-4 text-[14px] font-semibold text-fg">{p.label}</div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-fg-secondary">
                  {p.sub}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
