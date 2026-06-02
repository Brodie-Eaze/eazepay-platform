import { ArrowRight, LogoMark } from './icons';
import { Container, ctaPrimary, ctaGhostDark } from './primitives';
import { Reveal } from './Reveal';

export function Cta() {
  return (
    <section id="cta" className="ez-dark relative overflow-hidden py-24">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2]">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="ez-cta-glyph mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-sky text-white">
            <LogoMark size={24} />
          </span>
          <h2 className="mt-6 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[46px]">
            Put every brand on <span className="ez-gradient-text">one rail.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-white/70">
            Prequalification, agents, a lender marketplace and payment processing, one platform, one
            contract, behind every brand. Book a walkthrough and watch a live lead flow through it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/book" className={ctaPrimary}>
              Book a call
              <ArrowRight size={16} />
            </a>
            <a href="#platform" className={ctaGhostDark}>
              Explore the platform
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
