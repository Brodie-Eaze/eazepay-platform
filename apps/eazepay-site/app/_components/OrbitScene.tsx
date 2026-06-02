'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { LogoMark } from './icons';

type OrbitNode = {
  label: string;
  kind: 'agent' | 'vertical';
  deg: number; // ring angle, clockwise from 12 o'clock
  tz: number; // px of 3D depth
  d: string; // float animation delay
};

// Ten nodes on ONE even ring around the orchestration core: three vertical
// brands across the top arc, then the seven agents flowing clockwise.
const RING: OrbitNode[] = [
  { label: 'CoachPay', kind: 'vertical', deg: -52, tz: 40, d: '1.0s' },
  { label: 'MedPay', kind: 'vertical', deg: 0, tz: 44, d: '0.4s' },
  { label: 'TradePay', kind: 'vertical', deg: 52, tz: 40, d: '1.5s' },
  { label: 'PRISM', kind: 'agent', deg: 84, tz: 30, d: '0s' },
  { label: 'VEGA', kind: 'agent', deg: 116, tz: 26, d: '2.4s' },
  { label: 'ORACLE', kind: 'agent', deg: 148, tz: 28, d: '1.1s' },
  { label: 'HELIX', kind: 'agent', deg: 180, tz: 24, d: '2.2s' },
  { label: 'NEXUS', kind: 'agent', deg: 212, tz: 28, d: '0.7s' },
  { label: 'FLUX', kind: 'agent', deg: 244, tz: 26, d: '1.7s' },
  { label: 'ECHO', kind: 'agent', deg: 276, tz: 30, d: '2.7s' },
];

const RX = 32;
const RY = 36;
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
  } as CSSProperties;
}

/**
 * The hero constellation, made interactive: the whole orbit tilts in 3D toward
 * the cursor (smoothed via a requestAnimationFrame lerp on --px/--py), so the
 * depth of every node parallaxes as you move. Respects reduced-motion and
 * touch (pointer parallax simply stays neutral).
 */
export function OrbitScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      tx = Math.max(-1.6, Math.min(1.6, nx));
      ty = Math.max(-1.6, Math.min(1.6, ny));
    };
    const reset = () => {
      tx = 0;
      ty = 0;
    };

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--px', cx.toFixed(4));
      el.style.setProperty('--py', cy.toFixed(4));
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('mouseleave', reset);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('blur', reset);
      document.removeEventListener('mouseleave', reset);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="ez-core-scene relative mx-auto aspect-square w-full max-w-[460px]">
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
