import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';
import { RoutingTree } from './RoutingTree';

/**
 * The smart-routing section: a guided walkthrough where one live lead is driven
 * through the pipeline stage by stage — captured, qualified on real financials,
 * routed down its branch, booked. The interactive state machine lives in
 * RoutingTree (client); this is the section shell + copy.
 */
export function LeadFlow() {
  return (
    <section id="flow" className="ez-dark relative overflow-hidden py-24">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2]">
        <Reveal className="max-w-3xl">
          <Eyebrow>Smart routing · built for sales teams</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px]">
            One smart form, <span className="ez-gradient-text">routed in real time.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Follow a live lead through the rail. It&apos;s captured from any funnel, qualified on
            credit, income and available credit in seconds, then routed by ticket size and intent —
            high-ticket buyers straight to a closer&apos;s calendar, everyone else to the right
            nurture or offer. Each stage lights up as the lead arrives.
          </p>
        </Reveal>

        <Reveal className="mt-9">
          <RoutingTree />
        </Reveal>
      </Container>
    </section>
  );
}
