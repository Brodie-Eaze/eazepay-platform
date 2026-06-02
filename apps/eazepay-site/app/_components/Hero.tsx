import type { CSSProperties } from 'react';
import { ArrowRight } from './icons';
import { OrbitScene } from './OrbitScene';
import { Container, Eyebrow, ctaPrimary, ctaGhostDark } from './primitives';

const rise = (i: number): CSSProperties => ({ '--ri': i }) as CSSProperties;

export function Hero() {
  return (
    <section id="top" className="ez-dark relative overflow-hidden">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2] grid items-center gap-14 py-20 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:py-28">
        {/* ---- copy column ---- */}
        <div>
          <div className="ez-hero-rise" style={rise(0)}>
            <Eyebrow>The orchestration platform</Eyebrow>
          </div>

          <h1
            className="ez-hero-rise mt-5 text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-[52px] lg:text-[60px]"
            style={rise(1)}
          >
            Agentic financial infrastructure{' '}
            <span className="ez-gradient-text">behind every brand.</span>
          </h1>

          <p
            className="ez-hero-rise mt-6 max-w-[36rem] text-[16px] leading-relaxed text-white/70"
            style={rise(2)}
          >
            EazePay is the financial infrastructure behind the brand, prequalification, agents, a
            lender marketplace and payment processing on one platform. MedPay, TradePay, CoachPay
            and VetPay are brand wrappers riding the exact same rail.
          </p>

          <div className="ez-hero-rise mt-8 flex flex-wrap items-center gap-3" style={rise(3)}>
            <a href="/book" className={ctaPrimary}>
              Book a call
              <ArrowRight size={16} />
            </a>
            <a href="#flow" className={ctaGhostDark}>
              See a lead flow through it
            </a>
          </div>

          <ul
            className="ez-hero-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] font-medium text-white/55"
            style={rise(4)}
          >
            {['SOC 2 Type II', 'Lender marketplace'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-sky-soft" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- 3D orchestration core (interactive parallax + boot-up assembly) ---- */}
        <OrbitScene />
      </Container>

      {/* fade into the next (light) section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
    </section>
  );
}
