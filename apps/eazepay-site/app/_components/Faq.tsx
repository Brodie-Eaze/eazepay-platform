import { FAQ } from '../data';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

export function Faq() {
  return (
    <section id="faq" className="bg-bg-muted py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[40px]">
              Frequently asked <span className="ez-sky-text">questions.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-fg-secondary">
              The essentials on how EazePay works — the infrastructure, the brands,
              prequalification, the marketplace and payments. Need more? Book a call and we&apos;ll
              walk you through it.
            </p>
          </Reveal>

          <Reveal delay={90}>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-elevated">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15px] font-semibold text-fg transition-colors hover:bg-bg-muted/60 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-fg-muted transition-transform duration-300 group-open:rotate-45">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-6 pb-5 text-[14px] leading-relaxed text-fg-secondary">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
