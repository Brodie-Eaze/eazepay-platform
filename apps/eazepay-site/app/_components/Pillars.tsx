import { PILLARS } from '../data';
import { FlowScore, Spark, FlowWaterfall, FlowSettle, Layers, Check } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const PILLAR_ICONS = [FlowScore, Spark, FlowWaterfall, FlowSettle];

export function Pillars() {
  return (
    <section className="bg-bg-muted py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>The financial infrastructure</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            One infrastructure. <span className="ez-sky-text">Four parts.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            Prequalification, agents, a lender marketplace and payment processing, built as one
            system, behind every brand. This is what EazePay actually is.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {PILLARS.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? Layers;
            return (
              <Reveal key={p.tag} delay={(i % 2) * 90} className="h-full">
                <div className="ez-card flex h-full flex-col rounded-2xl border border-border bg-bg-elevated p-7">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-sky/10 text-brand-sky">
                      <Icon size={20} />
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                      {p.tag}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[20px] font-bold leading-snug tracking-[-0.01em] text-fg">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-fg-secondary">{p.body}</p>
                  <ul className="mt-5 space-y-2.5 pb-6">
                    {p.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex gap-2.5 text-[13px] leading-snug text-fg-secondary"
                      >
                        <Check size={15} className="mt-0.5 shrink-0 text-brand-sky" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto border-t border-border pt-6">
                    <span className="ez-eyebrow text-brand-sky">{p.metric}</span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
