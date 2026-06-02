'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper. Renders visible on the server (SSR/no-JS safe, the
 * site.css default for `[data-reveal='out']` only applies once this component
 * has mounted and set the attribute, and a <noscript> override in layout.tsx
 * forces everything visible when JS is off). On mount it watches for the
 * element entering the viewport and flips `data-reveal` to 'in', which the CSS
 * transitions. One-shot: it disconnects after the first reveal.
 *
 * Resilience, content must NEVER be left permanently invisible (opacity:0):
 *   (a) no IntersectionObserver support  → reveal immediately;
 *   (b) element already within the viewport at mount → reveal immediately
 *       (covers above-the-fold sections and flaky IO initial callbacks);
 *   (c) threshold 0 so a Reveal taller than the viewport, whose intersection
 *       ratio could never reach a higher threshold, still fires the moment any
 *       part scrolls in, instead of staying hidden forever.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    // Already on screen at mount → reveal now; don't depend on an observer tick.
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom >= 0 && rect.top <= vh * 0.92) {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={inView ? 'in' : 'out'}
      className={className}
      style={{ ...style, '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
