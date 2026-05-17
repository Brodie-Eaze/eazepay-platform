/**
 * Billing period math — period IDs, labels, navigation, "is this
 * draft for the period that's currently selected" predicates.
 *
 * Periods are calendar-aligned by default (monthly: YYYY-MM,
 * weekly: ISO week). The UI navigates by stepping through these.
 */

export type Period = {
  /** Stable string ID safe for keying + URL — eg "2026-05" or "2026-W19". */
  id: string;
  /** Human label — "May 2026" / "Week of May 5, 2026". */
  label: string;
  /** Inclusive start ISO date. */
  startDate: string;
  /** Inclusive end ISO date. */
  endDate: string;
  /** Suggested due-date — first/last day of the next period for invoice issuance. */
  dueDate: string;
  cycle: 'monthly' | 'weekly';
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthlyPeriod(year: number, monthIndex: number): Period {
  // monthIndex is 0-based per Date convention.
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  // Default due-date: last day of the same month (accounts can edit
  // per invoice in the drawer).
  return {
    id: `${year}-${pad(monthIndex + 1)}`,
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
    startDate: isoDate(first),
    endDate: isoDate(last),
    dueDate: isoDate(last),
    cycle: 'monthly',
  };
}

export function currentMonthlyPeriod(today = new Date()): Period {
  return monthlyPeriod(today.getFullYear(), today.getMonth());
}

export function stepPeriod(p: Period, delta: -1 | 1): Period {
  if (p.cycle === 'monthly') {
    const [yStr, mStr] = p.id.split('-');
    const y = Number(yStr);
    const m = Number(mStr) - 1;
    return monthlyPeriod(y, m + delta);
  }
  // Weekly cycle isn't enabled in the UI today; placeholder.
  return p;
}

/** True if `dateIso` falls inside the inclusive period bounds. */
export function isInPeriod(dateIso: string, p: Period): boolean {
  return dateIso >= p.startDate && dateIso <= p.endDate;
}

/**
 * Calculate the next billing run date for a partner config and the
 * current date — used by the Automation tab to surface "Next run:
 * <date> · <countdown>".
 */
export function nextRunDate(
  cycle: 'monthly' | 'weekly' | 'paused',
  dayOfPeriod: number,
  today = new Date(),
): string | null {
  if (cycle === 'paused') return null;
  if (cycle === 'monthly') {
    const target = Math.min(28, Math.max(1, dayOfPeriod));
    const thisMonthRun = new Date(today.getFullYear(), today.getMonth(), target);
    const next =
      today.getDate() <= target
        ? thisMonthRun
        : new Date(today.getFullYear(), today.getMonth() + 1, target);
    return isoDate(next);
  }
  if (cycle === 'weekly') {
    const target = ((dayOfPeriod % 7) + 7) % 7;
    const cur = today.getDay();
    const offset = (target - cur + 7) % 7 || 7;
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return isoDate(next);
  }
  return null;
}
