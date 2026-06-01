import { PILLARS } from '../data';
import { Layers, FlowWaterfall, Spark, Shield, Check } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const PILLAR_ICONS = [Layers, FlowWaterfall, Spark, Shield];

export function Pillars() {
  return (
    <section className="bg-bg-muted py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>Why it holds together</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Four layers. <span className="ez-sky-text">One contract.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            Orchestration, marketplace, agents and settlement — built as one system, billed as one
            line, audited as one platform.
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
                  <ul className="mt-5 space-y-2.5">
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
