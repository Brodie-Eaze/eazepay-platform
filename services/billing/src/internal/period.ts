/**
 * Period math — period IDs ("YYYY-MM" for monthly), human labels,
 * inclusive start/end Dates, and a default due date (last day of the
 * billing month). Backend-only; the partner-portal has its own copy
 * for client-side navigation that doesn't need to hit the API.
 */

export type Period = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  defaultDue: Date;
};

const MONTHS = [
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

/** Build a monthly period from a "YYYY-MM" id, UTC-aligned to avoid TZ drift. */
export function parseMonthlyPeriod(id: string): Period {
  const m = /^(\d{4})-(\d{2})$/.exec(id);
  if (!m) throw new Error(`invalid period id: ${id}`);
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`invalid month in ${id}`);
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    id,
    label: `${MONTHS[monthIndex]} ${year}`,
    start,
    end,
    defaultDue: end,
  };
}

export function currentMonthlyPeriodId(today = new Date()): string {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
