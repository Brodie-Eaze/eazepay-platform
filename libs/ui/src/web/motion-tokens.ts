/**
 * Motion design tokens — Sprint A.
 *
 * Vocabulary first, primitives second. Every animated component in
 * `@eazepay/ui/web` reaches for these constants instead of hand-rolling
 * durations or easings, so the platform develops a consistent motion
 * language (Linear / Stripe / Cal.com tier).
 *
 * Values are seconds (Motion's default unit for `duration`) and
 * cubic-bezier 4-tuples (Motion's `ease` format). Spring entries use
 * Motion's spring-config object shape.
 */
export const motion = {
  duration: {
    instant: 0.1,
    fast: 0.18,
    default: 0.24,
    slow: 0.36,
    epic: 0.6,
  },
  ease: {
    // Linear-style ease-out — the workhorse curve for enters and
    // micro-interactions. Slight overshoot at the front, soft landing.
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
    in: [0.7, 0, 0.84, 0] as [number, number, number, number],
    inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
    // Motion's string-spring DSL — `spring(mass, stiffness, damping, velocity)`.
    spring: 'spring(1, 100, 10, 0)',
  },
  spring: {
    snappy: { stiffness: 400, damping: 30 },
    gentle: { stiffness: 200, damping: 25 },
    soft: { stiffness: 100, damping: 20 },
  },
} as const;

export type MotionDuration = keyof typeof motion.duration;
export type MotionEase = keyof typeof motion.ease;
export type MotionSpring = keyof typeof motion.spring;
