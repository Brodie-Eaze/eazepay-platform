'use client';

import { useEffect, useRef } from 'react';

/**
 * A soft volumetric spotlight that tracks the cursor across the dark hero —
 * the "the room lights up where you look" effect. Sets --hx/--hy on its own
 * element via a smoothed rAF lerp; the radial-gradient background follows.
 * Pure progressive enhancement: with no JS / reduced-motion it sits centered.
 */
export function HeroSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = 50;
    let ty = 38;
    let cx = 50;
    let cy = 38;

    const onMove = (e: MouseEvent) => {
      const r = host.getBoundingClientRect();
      if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
    };

    const loop = () => {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      el.style.setProperty('--hx', `${cx.toFixed(2)}%`);
      el.style.setProperty('--hy', `${cy.toFixed(2)}%`);
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="ez-hero-spot" aria-hidden />;
}
