import type { FC } from 'react';

/**
 * EazePay wordmark + mark. Mark is a stacked chevron pair conveying
 * "flow + acceleration" — money + applications moving through the
 * orchestration engine. Kept self-contained so any surface (consumer,
 * merchant, admin, partner, developer) can drop it in.
 */
export const Logo: FC<{ size?: number; variant?: 'full' | 'mark'; className?: string }> = ({
  size = 28,
  variant = 'full',
  className,
}) => {
  const markSize = size;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: variant === 'full' ? 10 : 0,
        fontWeight: 700,
        fontSize: size * 0.7,
        letterSpacing: '-0.02em',
        color: 'rgb(var(--fg))',
        lineHeight: 1,
      }}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="url(#eazepay-grad)" />
        <path
          d="M9.5 12.5L16 8L22.5 12.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 17.5L16 13L22.5 17.5"
          stroke="white"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 22.5L16 18L22.5 22.5"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient
            id="eazepay-grad"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="rgb(var(--accent))" />
            <stop offset="1" stopColor="rgb(var(--chart-6))" />
          </linearGradient>
        </defs>
      </svg>
      {variant === 'full' && (
        <span>
          eaze<span style={{ color: 'rgb(var(--accent))' }}>pay</span>
        </span>
      )}
    </span>
  );
};
