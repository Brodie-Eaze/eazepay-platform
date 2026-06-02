import { ArrowRight } from './icons';
import { OrbitScene } from './OrbitScene';
import { Container, Eyebrow, ctaPrimary, ctaGhostDark } from './primitives';

export function Hero() {
  return (
    <section id="top" className="ez-dark relative overflow-hidden">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2] grid items-center gap-14 py-20 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:py-28">
        {/* ---- copy column ---- */}
        <div>
          <Eyebrow>The orchestration platform</Eyebrow>

          <h1 className="mt-5 text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-[52px] lg:text-[60px]">
            One rail beneath
            <br />
            <span className="ez-gradient-text">every payment brand.</span>
          </h1>

          <p className="mt-6 max-w-[36rem] text-[16px] leading-relaxed text-white/70">
            EazePay is the orchestration layer — card processing, a lender marketplace, seven
            autonomous agents and merchant-direct settlement on a single API. MedPay, TradePay and
            CoachPay are vertical brands riding the same rail.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#cta" className={ctaPrimary}>
              Start orchestrating
              <ArrowRight size={16} />
            </a>
            <a href="#flow" className={ctaGhostDark}>
              See a lead flow through it
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] font-medium text-white/55">
            {['SOC 2 Type II', 'PCI-DSS Level 1', 'FCRA-aware agents', 'Lender marketplace'].map(
              (t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-sky-soft" aria-hidden />
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>

        {/* ---- 3D orchestration core (interactive parallax) ---- */}
        <OrbitScene />
      </Container>

      {/* fade into the next (light) section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
    </section>
  );
}
