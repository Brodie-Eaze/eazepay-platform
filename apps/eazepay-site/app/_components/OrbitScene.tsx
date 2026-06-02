import type { CSSProperties } from 'react';
import { LogoMark } from './icons';

type OrbitNode = {
  label: string;
  kind: 'agent' | 'vertical';
  deg: number; // ring angle, clockwise from 12 o'clock
  tz: number; // px of 3D depth
  d: string; // float animation delay
};

// Eleven nodes evenly spaced on ONE true ring (360/11 ≈ 32.7° apart, perfectly
// symmetric about the vertical axis): four brand wrappers grouped across the top,
// the seven agents filling the rest clockwise. Uniform depth per group so each
// sits cleanly on the ring.
const RING: OrbitNode[] = [
  { label: 'CoachPay', kind: 'vertical', deg: -49.1, tz: 38, d: '1.0s' },
  { label: 'MedPay', kind: 'vertical', deg: -16.4, tz: 38, d: '0.4s' },
  { label: 'TradePay', kind: 'vertical', deg: 16.4, tz: 38, d: '1.5s' },
  { label: 'VetPay', kind: 'vertical', deg: 49.1, tz: 38, d: '0.8s' },
  { label: 'PRISM', kind: 'agent', deg: 81.8, tz: 28, d: '0s' },
  { label: 'VEGA', kind: 'agent', deg: 114.5, tz: 28, d: '2.4s' },
  { label: 'ORACLE', kind: 'agent', deg: 147.3, tz: 28, d: '1.1s' },
  { label: 'HELIX', kind: 'agent', deg: 180, tz: 28, d: '2.2s' },
  { label: 'NEXUS', kind: 'agent', deg: 212.7, tz: 28, d: '0.7s' },
  { label: 'FLUX', kind: 'agent', deg: 245.5, tz: 28, d: '1.7s' },
  { label: 'ECHO', kind: 'agent', deg: 278.2, tz: 28, d: '2.7s' },
];

const RX = 35;
const RY = 35;
const NODES = RING.map((n, i) => {
  const rad = (n.deg * Math.PI) / 180;
  return { ...n, i, x: 50 + RX * Math.sin(rad), y: 50 - RY * Math.cos(rad) };
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
    '--se': `${(0.42 + i * 0.04).toFixed(2)}s`,
  } as CSSProperties;
}

/**
 * The hero constellation. Held at a fixed 3D tilt, it does NOT sway side to
 * side and does NOT track the cursor. It comes to life through light: the core
 * breathes, energy pulses inward along the spokes, nodes drift + ping, rings
 * expand. All depth, no wandering.
 */
export function OrbitScene() {
  return (
    <div className="relative">
      <div className="ez-core-scene relative mx-auto aspect-square w-full max-w-[460px]">
        <div className="ez-core-tilt absolute inset-0">
          <div className="ez-core-stage absolute inset-0">
            <span className="ez-orbit-ring" aria-hidden />

            {NODES.map((n) => (
              <span
                key={`s-${n.label}`}
                className="ez-spoke"
                style={spoke(n.x, n.y, n.i)}
                aria-hidden
              />
            ))}

            <span className="ez-core__ring" aria-hidden />
            <span className="ez-core__ring ez-core__ring--2" aria-hidden />
            <span className="ez-core__ring ez-core__ring--3" aria-hidden />
            <span className="ez-core-halo" aria-hidden />

            <div className="ez-core" aria-hidden>
              <span className="ez-core__mark">
                <LogoMark size={30} className="text-white" />
              </span>
            </div>

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
                    '--ne': `${(0.7 + n.i * 0.05).toFixed(2)}s`,
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
    </div>
  );
}
