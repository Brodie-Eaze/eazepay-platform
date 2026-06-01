import type { SVGProps } from 'react';

/* Inline stroke icons — currentColor, 1.6 weight, 24-grid. Server-rendered. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

/**
 * EazePay brandmark — a monogram "E" built from three rounded rails (the
 * platform's stacked layers) with a detached node routed off the middle rail
 * (a lead moving through the orchestration). Filled, not stroked, so it reads
 * as a real logo at any size. Inherits `currentColor` (white on the navy tile).
 */
export const LogoMark = ({ size = 22, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <rect x="4.4" y="4" width="3.2" height="16" rx="1.6" />
    <rect x="7" y="4" width="12.6" height="3.3" rx="1.65" />
    <rect x="7" y="10.35" width="8.4" height="3.3" rx="1.65" />
    <rect x="7" y="16.7" width="12.6" height="3.3" rx="1.65" />
    <rect x="17.4" y="10.6" width="2.8" height="2.8" rx="0.9" opacity="0.55" />
  </svg>
);

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Check = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const Shield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const Bolt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

export const Layers = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const Spark = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    <path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18" opacity={0.55} />
  </svg>
);

/* lead-flow node glyphs */

export const FlowForm = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const FlowScore = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 18l4-5" />
    <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const FlowRoute = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 12h3l5-5M11 12l5 5" />
  </svg>
);

export const FlowWaterfall = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16M6 11h12M8 16h8M10 21h4" />
  </svg>
);

export const FlowSettle = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 15h3" />
  </svg>
);

export const FLOW_ICON = {
  form: FlowForm,
  score: FlowScore,
  route: FlowRoute,
  waterfall: FlowWaterfall,
  settle: FlowSettle,
} as const;
