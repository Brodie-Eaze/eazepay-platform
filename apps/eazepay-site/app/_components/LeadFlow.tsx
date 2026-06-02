import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';
import { RoutingTree } from './RoutingTree';

/**
 * The smart-routing section: a guided walkthrough where one live lead is driven
 * through the pipeline stage by stage, captured, qualified on real financials,
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
            One smart form, <span className="ez-gradient-text">routed your way.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Route on whatever you want, credit, income, or the answers the form collects. Switch
            configurations below and watch a live lead walk each one: sequential financial gates, a
            parallel score plus an intent question, or pure question based routing. Every decision
            lights up as the lead finds its funnel.
          </p>
        </Reveal>

        <Reveal className="mt-9">
          <RoutingTree />
        </Reveal>
      </Container>
    </section>
  );
}
