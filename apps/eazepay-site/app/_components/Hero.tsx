import type { CSSProperties } from 'react';
import { ArrowRight, LogoMark } from './icons';
import { Container, Eyebrow, ctaPrimary, ctaGhostDark } from './primitives';

type OrbitNode = {
  label: string;
  kind: 'agent' | 'vertical';
  deg: number; // ring angle, clockwise from 12 o'clock
  tz: number; // px of 3D depth
  d: string; // float animation delay
};

// Ten nodes on ONE even ring around the orchestration core: three vertical
// brands across the prominent top arc, then the seven agents flowing clockwise
// around the rest of the ring in pipeline order (intake → … → attribution).
// Angles are evenly spaced so the constellation reads as an intentional ring,
// not a scatter; positions are projected geometrically below.
const RING: OrbitNode[] = [
  // vertical brands — top arc, prominent white pills (symmetric about 12 o'clock)
  { label: 'CoachPay', kind: 'vertical', deg: -52, tz: 40, d: '1.0s' },
  { label: 'MedPay', kind: 'vertical', deg: 0, tz: 44, d: '0.4s' },
  { label: 'TradePay', kind: 'vertical', deg: 52, tz: 40, d: '1.5s' },
  // seven agents — clockwise from top-right around the ring, dark pills
  { label: 'PRISM', kind: 'agent', deg: 84, tz: 30, d: '0s' },
  { label: 'VEGA', kind: 'agent', deg: 116, tz: 26, d: '2.4s' },
  { label: 'ORACLE', kind: 'agent', deg: 148, tz: 28, d: '1.1s' },
  { label: 'HELIX', kind: 'agent', deg: 180, tz: 24, d: '2.2s' },
  { label: 'NEXUS', kind: 'agent', deg: 212, tz: 28, d: '0.7s' },
  { label: 'FLUX', kind: 'agent', deg: 244, tz: 26, d: '1.7s' },
  { label: 'ECHO', kind: 'agent', deg: 276, tz: 30, d: '2.7s' },
];

// Horizontal radius is tighter than vertical so the wide pills never clip the
// frame; both land on ~the 72% orbit ring. Projected once, reused for the node
// and its connector spoke.
const RX = 32;
const RY = 36;
const NODES = RING.map((n, i) => {
  const rad = (n.deg * Math.PI) / 180;
  return {
    ...n,
    i,
    x: 50 + RX * Math.sin(rad),
    y: 50 - RY * Math.cos(rad),
  };
});

function spoke(x: number, y: number, i: number): CSSProperties {
  const dx = x - 50;
  const dy = y - 50;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    width: `${len}%`,
    transform: `rotate(${ang}deg)`,
    '--sd': `${(i * 0.28).toFixed(2)}s`,
  } as CSSProperties;
}

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

        {/* ---- 3D orchestration core ---- */}
        <div className="relative">
          <div className="ez-core-scene relative mx-auto aspect-square w-full max-w-[460px]">
            <div className="ez-core-stage absolute inset-0">
              {/* faint orbit path with a sweeping radar arc */}
              <span className="ez-orbit-ring" aria-hidden />

              {/* connector spokes (base plane) */}
              {NODES.map((n) => (
                <span
                  key={`s-${n.label}`}
                  className="ez-spoke"
                  style={spoke(n.x, n.y, n.i)}
                  aria-hidden
                />
              ))}

              {/* concentric pulse rings */}
              <span className="ez-core__ring" aria-hidden />
              <span className="ez-core__ring ez-core__ring--2" aria-hidden />
              <span className="ez-core__ring ez-core__ring--3" aria-hidden />

              {/* rotating energy aura just outside the core */}
              <span className="ez-core-halo" aria-hidden />

              {/* the glowing centre */}
              <div className="ez-core" aria-hidden>
                <span className="ez-core__mark">
                  <LogoMark size={30} className="text-white" />
                </span>
              </div>

              {/* orbiting agent + vertical nodes */}
              {NODES.map((n) => (
                <span
                  key={n.label}
                  className={`ez-node${n.kind === 'vertical' ? ' ez-node--vertical' : ''}`}
                  style={
                    {
                      left: `${n.x}%`,
                      top: `${n.y}%`,
                      '--tz': `${n.tz}px`,
                      '--nd': n.d,
                    } as CSSProperties
                  }
                >
                  <span className="ez-node__dot" aria-hidden />
                  {n.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>

      {/* fade into the next (light) section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
    </section>
  );
}
