import type { FC } from 'react';

/**
 * Tiny inline SVG sparkline. No animation, no axes — just a trend
 * shape. Used inside KPI cards and table rows.
 */
export const Sparkline: FC<{
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  filled?: boolean;
}> = ({ data, width = 120, height = 32, className, filled = true }) => {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {filled && <path d={area} fill="currentColor" opacity={0.12} />}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** Multi-bar chart kept dependency-free. Each bar tone follows the
 *  current text color so caller controls hue via Tailwind. */
export const BarChart: FC<{
  data: Array<{ label: string; value: number }>;
  width?: number;
  height?: number;
  className?: string;
}> = ({ data, width = 480, height = 120, className }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const barWidth = width / data.length - 6;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (height - 24));
        const x = i * (barWidth + 6);
        const y = height - h - 12;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              fill="currentColor"
              opacity={0.75}
            />
            <text
              x={x + barWidth / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity={0.6}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
