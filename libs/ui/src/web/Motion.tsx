'use client';
import type { ElementType, FC, ReactNode } from 'react';
import { Children, useEffect, useRef, useState } from 'react';
import { motion as m, useReducedMotion, AnimatePresence } from 'motion/react';
import { motion as tokens } from './motion-tokens';

/**
 * Sprint A — Motion primitives.
 *
 * Each primitive checks `useReducedMotion()` and snaps to the final
 * state when the user has requested reduced motion. This is the
 * accessibility contract — non-negotiable.
 */

type FadeProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  as?: ElementType;
  className?: string;
};

/** Simple fade-in on mount. Default 240ms ease-out. */
export const MotionFade: FC<FadeProps> = ({
  children,
  delay = 0,
  duration = tokens.duration.default,
  as: As = 'div',
  className,
}) => {
  const reduced = useReducedMotion();
  const Component = m(As as any) as any;
  return (
    <Component
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration, delay, ease: tokens.ease.out }}
      className={className}
    >
      {children}
    </Component>
  );
};

type SlideProps = FadeProps & {
  /** Y offset to slide from. Positive = slides up into place. Default 8. */
  y?: number;
};

/** Slide + fade. Default from y:8 → y:0 over 240ms ease-out. */
export const MotionSlide: FC<SlideProps> = ({
  children,
  delay = 0,
  duration = tokens.duration.default,
  y = 8,
  as: As = 'div',
  className,
}) => {
  const reduced = useReducedMotion();
  const Component = m(As as any) as any;
  return (
    <Component
      initial={reduced ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration, delay, ease: tokens.ease.out }}
      className={className}
    >
      {children}
    </Component>
  );
};

/**
 * Stagger container — children animate in sequence (50ms apart by
 * default). Each direct child is wrapped in a motion.div with a
 * variant; pass already-motion children freely, they'll inherit.
 */
export const MotionStagger: FC<{
  children: ReactNode;
  /** Stagger between children (seconds). */
  stagger?: number;
  /** Delay before the first child starts. */
  delay?: number;
  /** Per-child slide distance. */
  y?: number;
  /** Per-child duration. */
  duration?: number;
  as?: ElementType;
  className?: string;
}> = ({
  children,
  stagger = 0.05,
  delay = 0,
  y = 6,
  duration = tokens.duration.default,
  as: As = 'div',
  className,
}) => {
  const reduced = useReducedMotion();
  const Container = m(As as any) as any;
  const itemVariants = {
    hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y },
    show: { opacity: 1, y: 0 },
  };
  return (
    <Container
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: reduced
            ? { staggerChildren: 0 }
            : { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={className}
    >
      {Children.map(children, (child, i) => (
        <m.div
          key={i}
          variants={itemVariants}
          transition={reduced ? { duration: 0 } : { duration, ease: tokens.ease.out }}
        >
          {child}
        </m.div>
      ))}
    </Container>
  );
};

/**
 * Number counter that animates from 0 → value on mount. Uses
 * requestAnimationFrame; no extra dependency. When value changes
 * after mount, animates from the previous displayed value.
 */
export const CountUp: FC<{
  value: number;
  /** Formatter — defaults to `Intl.NumberFormat()`. */
  format?: (n: number) => string;
  /** Animation duration in ms (the prop is ms for ergonomics; tokens are seconds). */
  duration?: number;
  className?: string;
}> = ({ value, format, duration = 800, className }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const fromRef = useRef(reduced ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    // Linear-style ease-out (1 - (1-t)^3) — cheap and matches token feel.
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOut(t);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced]);

  const formatter = format ?? ((n: number) => new Intl.NumberFormat().format(Math.round(n)));
  return <span className={className}>{formatter(display)}</span>;
};

/**
 * Gentle pulse — for LiveIndicator and "Live" badges. Scales 1 → 1.08
 * → 1 on a 1.6s loop. Reduced motion: no animation.
 */
export const MotionPulse: FC<{
  children: ReactNode;
  className?: string;
  /** Pulse cycle duration in seconds. */
  duration?: number;
}> = ({ children, className, duration = 1.6 }) => {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{children}</span>;
  return (
    <m.span
      className={className}
      animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </m.span>
  );
};

export { AnimatePresence, useReducedMotion };

/**
 * Route transition wrapper — fades between routes. Mount the children
 * with a key that changes per route (typically `pathname`). The portal
 * shell wraps `{children}` with this so every navigation crossfades
 * instead of popping.
 */
export const RouteTransition: FC<{ children: ReactNode; routeKey: string }> = ({
  children,
  routeKey,
}) => {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={routeKey}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0 }}
        transition={
          reduced ? { duration: 0 } : { duration: tokens.duration.fast, ease: tokens.ease.out }
        }
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
};
