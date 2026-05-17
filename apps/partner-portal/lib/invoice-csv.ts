/**
 * CSV export — current filtered view is rendered to a downloadable
 * file. Format mirrors the on-screen columns so the accounts team
 * can hand the same numbers to FinOps / external auditors.
 */
import type { FilterableInvoice } from './invoice-filter';

const HEADERS = [
  'Invoice No',
  'Merchant',
  'Email',
  'Vertical',
  'Period',
  'Due Date',
  'Gross Funded',
  'Fee %',
  'Fee Amount',
  'Status',
  'Voided',
];

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: FilterableInvoice[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.invoiceNo,
        r.merchant,
        r.email,
        r.vertical,
        r.periodLabel,
        r.dueDate,
        (r.grossFundedCents / 100).toFixed(2),
        (r.feePct * 100).toFixed(2),
        (r.feeAmountCents / 100).toFixed(2),
        r.status,
        r.voided ? 'yes' : 'no',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
