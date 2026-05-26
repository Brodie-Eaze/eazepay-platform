/**
 * Canonical time formatter. Resolves the 7 distinct date-format
 * patterns flagged by the audit.
 *
 * Modes:
 *  - `relative`  → "just now", "59s ago", "2m ago", "3h ago", "5d ago",
 *                  "2w ago", "3mo ago", "2y ago"
 *  - `precise`   → "May 26, 8:50pm"          (no year)
 *  - `iso`       → "2026-05-26T20:50:18.000Z"
 *  - `date`      → "May 26, 2026"
 *  - `datetime`  → "May 26, 2026, 8:50pm"
 *
 * `relative` uses `Intl.RelativeTimeFormat` for the locale-aware
 * fallback above one minute. Below one minute we hand-roll to keep
 * output stable across ICU versions (some return "0 seconds ago").
 *
 * `timeZone` defaults to the host's local TZ. Pass an IANA zone
 * (e.g. 'America/New_York') for server-side rendering where you want
 * a deterministic display TZ.
 */
export interface FormatTimeOptions {
  mode: 'relative' | 'precise' | 'iso' | 'date' | 'datetime';
  /** IANA timezone. Defaults to host local. */
  timeZone?: string;
  /** Locale override. Defaults to 'en-US'. */
  locale?: string;
  /** Reference instant for relative mode. Defaults to `Date.now()`.
   *  Exposed for deterministic tests. */
  now?: Date | number;
}

const MS = {
  sec: 1_000,
  min: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_800_000, // 30.4375 d — average Gregorian month
  year: 31_557_600_000, // 365.25 d
} as const;

function toDate(input: Date | string | number): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`formatTime: invalid date input ${String(input)}`);
  }
  return d;
}

function formatRelative(target: Date, now: Date, locale: string): string {
  const deltaMs = target.getTime() - now.getTime();
  const absMs = Math.abs(deltaMs);

  // Sub-minute: hand-rolled. Below 5s we say "just now" — matches
  // what the existing inline formatters across the app converge on.
  if (absMs < 5 * MS.sec) return 'just now';
  if (absMs < MS.min) {
    const s = Math.round(absMs / MS.sec);
    return deltaMs < 0 ? `${s}s ago` : `in ${s}s`;
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const sign = deltaMs < 0 ? -1 : 1;
  const pick: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', MS.year],
    ['month', MS.month],
    ['week', MS.week],
    ['day', MS.day],
    ['hour', MS.hour],
    ['minute', MS.min],
  ];
  for (const [unit, unitMs] of pick) {
    if (absMs >= unitMs) {
      const v = Math.round(absMs / unitMs) * sign;
      return rtf.format(v, unit);
    }
  }
  // Unreachable — sub-minute handled above.
  return rtf.format(0, 'second');
}

function ampmTime(d: Date, timeZone: string | undefined, locale: string): string {
  // "8:50pm" — lowercase, no space. Intl gives us "8:50 PM"; normalize.
  const parts = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).formatToParts(d);
  let hour = '';
  let minute = '';
  let dayPeriod = '';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value;
    else if (p.type === 'minute') minute = p.value;
    else if (p.type === 'dayPeriod') dayPeriod = p.value.toLowerCase().replace(/\s+|\./g, '');
  }
  return `${hour}:${minute}${dayPeriod}`;
}

export function formatTime(input: Date | string | number, opts: FormatTimeOptions): string {
  const d = toDate(input);
  const locale = opts.locale ?? 'en-US';
  const timeZone = opts.timeZone;

  switch (opts.mode) {
    case 'iso':
      return d.toISOString();

    case 'date':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      }).format(d);

    case 'datetime': {
      const datePart = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      }).format(d);
      return `${datePart}, ${ampmTime(d, timeZone, locale)}`;
    }

    case 'precise': {
      const datePart = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        timeZone,
      }).format(d);
      return `${datePart}, ${ampmTime(d, timeZone, locale)}`;
    }

    case 'relative': {
      const now = opts.now == null ? new Date() : toDate(opts.now);
      return formatRelative(d, now, locale);
    }
  }
}
