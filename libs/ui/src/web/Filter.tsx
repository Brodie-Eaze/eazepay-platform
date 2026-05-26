'use client';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { cn } from './cn';

/**
 * Canonical Filter primitive — collapses the five incompatible filter
 * patterns previously used across the platform (native <select>, custom
 * FilterChip, pill row, Shadcn Select, checkbox toggle) into one.
 *
 * Three variants:
 *   - 'select' (default): dropdown trigger + popover panel. Use for
 *     low-to-medium-traffic filters or any filter with many options.
 *   - 'tabs': horizontal segmented pill row. Use for high-traffic
 *     filters with ≤ 6 options (status, lifecycle stages).
 *   - 'chips': multi-line wrapping chips. Use when option count is high
 *     and the tab row would overflow.
 *
 * Always single-select; clearing returns `null` ("All"). Grouped options
 * render section headers between groups — for hierarchical filters like
 * Brand → Niche.
 *
 * The pure helpers (`flattenOptions`, `nextIndex`, `findIndexByValue`,
 * `isGroupedOptions`) are exported so the (node-only) spec suite can
 * exercise the behaviour hermetically without a DOM test runtime.
 */

export type FilterValue = string | null;

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional badge count rendered after the label. */
  count?: number;
  /** Optional secondary text rendered below the label in the popover. */
  description?: string;
  /** Disabled options are visible but unselectable. */
  disabled?: boolean;
}

export interface FilterGroup<T extends string = string> {
  /** Optional section header — for hierarchical filters like Brand → Niche. */
  label?: string;
  options: FilterOption<T>[];
}

export type FilterOptions<T extends string = string> = FilterOption<T>[] | FilterGroup<T>[];

export interface FilterProps<T extends string = string> {
  /** Label rendered as the trigger text when nothing is selected. */
  label: string;
  /** Currently selected value (single-select). `null` = "All [label]". */
  value: T | null;
  onChange: (v: T | null) => void;
  /** Either a flat list (most common) or grouped (hierarchical). */
  options: FilterOptions<T>;
  /**
   * Variant. Default 'select'.
   *  - 'select': dropdown trigger
   *  - 'tabs':   segmented pill row (≤ 6 options)
   *  - 'chips':  wrapping chips (many options)
   */
  variant?: 'select' | 'tabs' | 'chips';
  /** Allow clearing back to null. Default true. Hides the "All" entry if false. */
  clearable?: boolean;
  /** Optional class hook on the root element. */
  className?: string;
  /** Override the "All [label]" entry label. */
  allLabel?: string;
}

/* ─── Pure helpers (exported for hermetic node tests) ─────────────────── */

export function isGroupedOptions<T extends string>(
  opts: FilterOptions<T>,
): opts is FilterGroup<T>[] {
  return opts.length > 0 && typeof (opts as FilterGroup<T>[])[0]?.options !== 'undefined';
}

/** Flatten grouped or flat options to a single array, preserving order. */
export function flattenOptions<T extends string>(opts: FilterOptions<T>): FilterOption<T>[] {
  if (opts.length === 0) return [];
  if (isGroupedOptions(opts)) {
    const out: FilterOption<T>[] = [];
    for (const g of opts) for (const o of g.options) out.push(o);
    return out;
  }
  return opts as FilterOption<T>[];
}

/** Wrap-around arrow-key index resolver, skipping disabled rows. */
export function nextIndex(
  current: number,
  delta: 1 | -1,
  items: ReadonlyArray<{ disabled?: boolean }>,
): number {
  if (items.length === 0) return -1;
  let i = current;
  for (let step = 0; step < items.length; step++) {
    i = (i + delta + items.length) % items.length;
    if (!items[i]?.disabled) return i;
  }
  return current;
}

export function findIndexByValue<T extends string>(
  items: ReadonlyArray<FilterOption<T>>,
  value: T | null,
): number {
  if (value === null) return -1;
  for (let i = 0; i < items.length; i++) if (items[i]!.value === value) return i;
  return -1;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function Filter<T extends string>(props: FilterProps<T>): ReactElement {
  const {
    label,
    value,
    onChange,
    options,
    variant = 'select',
    clearable = true,
    className,
    allLabel,
  } = props;

  if (variant === 'tabs') {
    return (
      <TabsVariant
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        clearable={clearable}
        className={className}
        allLabel={allLabel}
      />
    );
  }
  if (variant === 'chips') {
    return (
      <ChipsVariant
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        clearable={clearable}
        className={className}
        allLabel={allLabel}
      />
    );
  }
  return (
    <SelectVariant
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      clearable={clearable}
      className={className}
      allLabel={allLabel}
    />
  );
}

/* ─── Select variant ──────────────────────────────────────────────────── */

function SelectVariant<T extends string>({
  label,
  value,
  onChange,
  options,
  clearable,
  className,
  allLabel,
}: Omit<FilterProps<T>, 'variant'>): ReactElement {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const flat = useMemo(() => flattenOptions(options), [options]);
  const selected = useMemo(() => flat.find((o) => o.value === value) ?? null, [flat, value]);

  /* Click-outside */
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* On open, seed active index to selected (or first selectable) */
  useEffect(() => {
    if (!open) return;
    const idx = findIndexByValue(flat, value ?? null);
    setActiveIdx(idx >= 0 ? idx : nextIndex(-1, 1, flat));
  }, [open, flat, value]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const choose = useCallback(
    (v: T | null) => {
      onChange(v);
      close();
    },
    [onChange, close],
  );

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => nextIndex(i, 1, flat));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => nextIndex(i, -1, flat));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = flat[activeIdx];
      if (opt && !opt.disabled) choose(opt.value);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIdx(nextIndex(-1, 1, flat));
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveIdx(nextIndex(0, -1, flat));
      return;
    }
  };

  const triggerLabel = selected ? selected.label : (allLabel ?? `All ${label.toLowerCase()}`);
  const showClear = clearable && value !== null;

  const grouped = isGroupedOptions(options);

  return (
    <div className={cn('relative inline-flex items-stretch', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Filter by ${label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex items-center gap-1.5 h-10 min-w-[140px] px-3 rounded-lg',
          'border border-border bg-bg-elevated text-[13px] text-fg font-medium',
          'hover:border-border-strong hover:bg-bg-muted/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong',
          showClear && 'pr-1.5',
        )}
      >
        <span className="text-fg-muted font-normal">{label}:</span>
        <span className="truncate">{triggerLabel}</span>
        <svg
          className="ml-auto text-fg-muted shrink-0"
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showClear && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label} filter`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-fg-muted hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M3 3l6 6M9 3l-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className="absolute z-30 top-[calc(100%+4px)] left-0 min-w-full max-w-[280px] rounded-lg border border-border bg-bg-elevated shadow-lg py-1 max-h-[320px] overflow-auto focus:outline-none"
        >
          {clearable && (
            <FilterOptionRow
              isActive={activeIdx === -1}
              isSelected={value === null}
              onSelect={() => choose(null)}
              onHover={() => setActiveIdx(-1)}
              label={allLabel ?? `All ${label.toLowerCase()}`}
              muted
            />
          )}
          {grouped
            ? (options as FilterGroup<T>[]).map((g, gi) => (
                <div key={`g-${gi}`} role="group" aria-label={g.label ?? undefined}>
                  {g.label && (
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
                      {g.label}
                    </div>
                  )}
                  {g.options.map((o) => {
                    const idx = flat.indexOf(o);
                    return (
                      <FilterOptionRow
                        key={o.value}
                        isActive={idx === activeIdx}
                        isSelected={o.value === value}
                        disabled={o.disabled}
                        onSelect={() => !o.disabled && choose(o.value)}
                        onHover={() => setActiveIdx(idx)}
                        label={o.label}
                        count={o.count}
                        description={o.description}
                      />
                    );
                  })}
                </div>
              ))
            : (options as FilterOption<T>[]).map((o, idx) => (
                <FilterOptionRow
                  key={o.value}
                  isActive={idx === activeIdx}
                  isSelected={o.value === value}
                  disabled={o.disabled}
                  onSelect={() => !o.disabled && choose(o.value)}
                  onHover={() => setActiveIdx(idx)}
                  label={o.label}
                  count={o.count}
                  description={o.description}
                />
              ))}
        </div>
      )}
    </div>
  );
}

function FilterOptionRow({
  label,
  count,
  description,
  isActive,
  isSelected,
  disabled,
  muted,
  onSelect,
  onHover,
}: {
  label: string;
  count?: number;
  description?: string;
  isActive: boolean;
  isSelected: boolean;
  disabled?: boolean;
  muted?: boolean;
  onSelect: () => void;
  onHover: () => void;
}): ReactElement {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      onMouseEnter={onHover}
      onClick={() => !disabled && onSelect()}
      className={cn(
        'flex items-start gap-2 px-3 py-2 text-[13px] cursor-pointer select-none',
        isActive && 'bg-bg-muted',
        disabled && 'opacity-50 cursor-not-allowed',
        muted && 'text-fg-secondary',
        !muted && 'text-fg',
      )}
    >
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {description && (
          <span className="block text-[11px] text-fg-muted truncate">{description}</span>
        )}
      </span>
      {typeof count === 'number' && (
        <span className="text-[11px] tabular-nums bg-bg-muted text-fg-secondary rounded-full px-1.5 py-0.5">
          {count}
        </span>
      )}
      {isSelected && (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-accent mt-0.5">
          <path
            d="M2.5 6.5L5 9l4.5-5.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}

/* ─── Tabs variant ────────────────────────────────────────────────────── */

function TabsVariant<T extends string>({
  label,
  value,
  onChange,
  options,
  clearable,
  className,
  allLabel,
}: Omit<FilterProps<T>, 'variant'>): ReactElement {
  const flat = useMemo(() => flattenOptions(options), [options]);
  const items = useMemo(() => {
    const arr: Array<{
      key: string;
      v: T | null;
      label: string;
      count?: number;
      disabled?: boolean;
    }> = [];
    if (clearable) {
      arr.push({ key: '__all', v: null, label: allLabel ?? 'All' });
    }
    for (const o of flat) {
      arr.push({ key: o.value, v: o.value, label: o.label, count: o.count, disabled: o.disabled });
    }
    return arr;
  }, [flat, clearable, allLabel]);

  const activeIdx = items.findIndex((it) => it.v === value);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')
      return;
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    const it = items[next];
    if (it && !it.disabled) onChange(it.v);
  };

  return (
    <div
      role="tablist"
      aria-label={`Filter by ${label}`}
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {items.map((it, idx) => {
        const active = idx === activeIdx;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onChange(it.v)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              'min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1',
              active
                ? 'bg-accent text-accent-fg'
                : 'text-fg-secondary hover:text-fg hover:bg-bg-muted',
              it.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span>{it.label}</span>
            {typeof it.count === 'number' && (
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  active ? 'text-accent-fg/80' : 'text-fg-muted',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Chips variant ───────────────────────────────────────────────────── */

function ChipsVariant<T extends string>({
  label,
  value,
  onChange,
  options,
  clearable,
  className,
  allLabel,
}: Omit<FilterProps<T>, 'variant'>): ReactElement {
  const grouped = isGroupedOptions(options);
  const flat = useMemo(() => flattenOptions(options), [options]);

  const Chip = ({ o, active }: { o: FilterOption<T>; active: boolean }): ReactElement => (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      disabled={o.disabled}
      onClick={() => onChange(active ? null : o.value)}
      className={cn(
        'min-h-[32px] inline-flex items-center gap-1.5 px-2.5 rounded-full border text-[12px] font-medium transition-colors whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        active
          ? 'bg-accent-soft text-accent border-accent/40'
          : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong hover:text-fg',
        o.disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {o.label}
      {typeof o.count === 'number' && (
        <span className="text-[10px] tabular-nums text-fg-muted">{o.count}</span>
      )}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={`Filter by ${label}`}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {clearable && (
        <button
          type="button"
          role="checkbox"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={cn(
            'min-h-[32px] inline-flex items-center px-2.5 rounded-full border text-[12px] font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            value === null
              ? 'bg-accent text-accent-fg border-accent'
              : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong',
          )}
        >
          {allLabel ?? 'All'}
        </button>
      )}
      {grouped
        ? (options as FilterGroup<T>[]).map((g, gi) => (
            <div
              key={`g-${gi}`}
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={g.label}
            >
              {g.label && (
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted mr-1">
                  {g.label}
                </span>
              )}
              {g.options.map((o) => (
                <Chip key={o.value} o={o} active={o.value === value} />
              ))}
            </div>
          ))
        : flat.map((o) => <Chip key={o.value} o={o} active={o.value === value} />)}
    </div>
  );
}
