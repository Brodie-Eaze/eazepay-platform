'use client';
import { useState, type FC, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Interactive bar + donut charts — pure SVG, dependency-free.
 *
 * WHY:
 *   The existing `<BarChart>` in Sparkline.tsx is a static SVG (no hover,
 *   no click). Sprint H needs every chart to be a navigation surface: hover
 *   shows the exact value, click fires onSelect with the datum so callers
 *   can route to a pre-filtered list view.
 *
 *   Rather than overload the existing primitive (some callers rely on its
 *   "no interaction" rendering), we ship a new pair next to it. Same
 *   visual language, but each bar / arc is a focusable element with hover
 *   tooltip + click handler.
 *
 *   Accessibility:
 *     - Each bar / arc renders as a <button>-styled <g> with role="button"
 *       and an aria-label that includes the label + formatted value, so a
 *       screen-reader gets "Feb 38 applications" rather than "rect".
 *     - Keyboard: each datum is in the tab order; Enter / Space fires
 *       onSelect.
 */

export interface InteractiveDatum {
  label: string;
  value: number;
  /** Optional payload — round-tripped to onSelect / onHover. */
  meta?: Record<string, unknown>;
}

export interface InteractiveBarChartProps {
  data: InteractiveDatum[];
  /** Y-axis max. Default: auto-rounded to nearest 25 above series max. */
  yMax?: number;
  /** Step between gridlines. Default: yMax / 2. */
  yStep?: number;
  /** Hover tooltip formatter for the value. Default: String(value). */
  formatValue?: (d: InteractiveDatum) => string;
  /** Fired when user clicks (or Enter/Space-activates) a bar. */
  onSelect?: (d: InteractiveDatum, index: number) => void;
  /** Fired when user hovers a bar. Pass `null` for the leave event. */
  onHover?: (d: InteractiveDatum | null, index: number | null) => void;
  /** Optional className for the wrapping <svg>. */
  className?: string;
  /** Accessible chart title. Required for a11y. */
  ariaLabel: string;
}

export const InteractiveBarChart: FC<InteractiveBarChartProps> = ({
  data,
  yMax,
  yStep,
  formatValue = (d) => String(d.value),
  onSelect,
  onHover,
  className,
  ariaLabel,
}) => {
  const [active, setActive] = useState<number | null>(null);

  if (!data.length) return null;

  const seriesMax = Math.max(...data.map((d) => d.value), 1);
  const yCap = yMax ?? Math.max(10, Math.ceil(seriesMax / 25) * 25);
  const yStepCap = yStep ?? yCap / 2;

  const width = 320;
  const height = 180;
  const padLeft = 28;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const gridLines: number[] = [];
  for (let v = 0; v <= yCap; v += yStepCap) gridLines.push(v);

  const barSlot = plotW / data.length;
  const barWidth = Math.min(28, barSlot * 0.55);

  const handleSelect = (d: InteractiveDatum, i: number) => () => {
    onSelect?.(d, i);
  };
  const handleEnter = (d: InteractiveDatum, i: number) => () => {
    setActive(i);
    onHover?.(d, i);
  };
  const handleLeave = () => {
    setActive(null);
    onHover?.(null, null);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        {/* horizontal grid + y-axis labels */}
        {gridLines.map((g) => {
          const y = padTop + plotH - (g / yCap) * plotH;
          return (
            <g key={`grid-${g}`}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                strokeWidth={0.5}
                className="stroke-border"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-fg-muted"
                fontSize={9}
              >
                {g}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {data.map((d, i) => {
          const cx = padLeft + barSlot * (i + 0.5);
          const h = (d.value / yCap) * plotH;
          const y = padTop + plotH - h;
          const isActive = active === i;
          const isInteractive = !!(onSelect || onHover);
          return (
            <g
              key={`${d.label}-${i}`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${d.label}: ${formatValue(d)}`}
              onClick={onSelect ? handleSelect(d, i) : undefined}
              onMouseEnter={isInteractive ? handleEnter(d, i) : undefined}
              onMouseLeave={isInteractive ? handleLeave : undefined}
              onFocus={isInteractive ? handleEnter(d, i) : undefined}
              onBlur={isInteractive ? handleLeave : undefined}
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(d, i);
                      }
                    }
                  : undefined
              }
              className={cn(
                isInteractive && 'cursor-pointer outline-none',
                isInteractive &&
                  'focus-visible:[&>rect]:stroke-border-focus focus-visible:[&>rect]:stroke-2',
              )}
            >
              {/* invisible hit-target — full column height so hover is forgiving */}
              <rect
                x={cx - barSlot / 2 + 2}
                y={padTop}
                width={Math.max(barWidth, barSlot - 4)}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={cx - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(0, h)}
                rx={2}
                className={cn(
                  'transition-opacity',
                  isActive ? 'fill-fg' : 'fill-fg-secondary/70',
                  active !== null && !isActive && 'opacity-40',
                )}
              />
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                className="fill-fg-muted pointer-events-none"
                fontSize={10}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {active !== null && data[active] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-fg px-2 py-1 text-[11px] font-semibold text-bg-elevated shadow-md whitespace-nowrap"
        >
          <span className="opacity-70 mr-1">{data[active].label}</span>
          <span className="tabular-nums">{formatValue(data[active])}</span>
        </div>
      )}
    </div>
  );
};

/* ─── Interactive donut ──────────────────────────────────────────────── */

export interface InteractiveDonutSegment {
  name: string;
  count: number;
  /** Stroke colour. Hex or any CSS colour string. */
  color: string;
  /** Optional descriptor rendered in the tooltip. e.g. "700–850". */
  description?: string;
}

export interface InteractiveDonutProps {
  segments: InteractiveDonutSegment[];
  /** Centre-of-donut headline number. Default: sum of segment counts. */
  total?: number;
  /** Label rendered beneath the centre number. Default 'total'. */
  centerLabel?: string;
  size?: number;
  stroke?: number;
  /** Click handler — fires when user activates a segment. */
  onSelect?: (segment: InteractiveDonutSegment, index: number) => void;
  /** Hover handler — fires with `null` on leave. */
  onHover?: (segment: InteractiveDonutSegment | null, index: number | null) => void;
  ariaLabel: string;
  className?: string;
  /** Render a tooltip near the cursor — leave on by default. */
  tooltip?: boolean;
  /** Optional renderer for tooltip body — overrides the default. */
  renderTooltip?: (segment: InteractiveDonutSegment) => ReactNode;
}

export const InteractiveDonut: FC<InteractiveDonutProps> = ({
  segments,
  total,
  centerLabel = 'total',
  size = 160,
  stroke = 22,
  onSelect,
  onHover,
  ariaLabel,
  className,
  tooltip = true,
  renderTooltip,
}) => {
  const [active, setActive] = useState<number | null>(null);
  const safeTotal = total ?? segments.reduce((s, x) => s + x.count, 0);
  const denom = safeTotal > 0 ? safeTotal : 1;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn('relative inline-block', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-bg-muted"
        />
        {segments.map((s, i) => {
          const fraction = s.count / denom;
          const dash = fraction * c;
          const gap = c - dash;
          const dashOffset = -offset;
          offset += dash;
          const isActive = active === i;
          const isInteractive = !!(onSelect || onHover);
          return (
            <circle
              key={`${s.name}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isActive ? stroke + 3 : stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${s.name}: ${s.count}`}
              onClick={onSelect ? () => onSelect(s, i) : undefined}
              onMouseEnter={
                isInteractive
                  ? () => {
                      setActive(i);
                      onHover?.(s, i);
                    }
                  : undefined
              }
              onMouseLeave={
                isInteractive
                  ? () => {
                      setActive(null);
                      onHover?.(null, null);
                    }
                  : undefined
              }
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(s, i);
                      }
                    }
                  : undefined
              }
              style={{
                cursor: isInteractive ? 'pointer' : undefined,
                opacity: active !== null && !isActive ? 0.4 : 1,
                transition: 'opacity 120ms, stroke-width 120ms',
              }}
            />
          );
        })}
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="fill-fg pointer-events-none"
          fontSize={26}
          fontWeight={600}
        >
          {active !== null && segments[active] ? segments[active].count : safeTotal}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          className="fill-fg-muted pointer-events-none"
          fontSize={10}
        >
          {active !== null && segments[active] ? segments[active].name : centerLabel}
        </text>
      </svg>
      {tooltip && active !== null && segments[active] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md border border-border bg-fg px-2 py-1 text-[11px] font-semibold text-bg-elevated shadow-md whitespace-nowrap"
        >
          {renderTooltip ? (
            renderTooltip(segments[active]!)
          ) : (
            <>
              <span className="opacity-70 mr-1">{segments[active]!.name}</span>
              <span className="tabular-nums">
                {segments[active]!.count}
                {segments[active]!.description ? ` · ${segments[active]!.description}` : ''}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
