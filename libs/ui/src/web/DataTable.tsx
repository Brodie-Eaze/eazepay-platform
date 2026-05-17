'use client';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Right-align numerics / dates */
  align?: 'left' | 'right' | 'center';
  /** Optional fixed width, e.g. '120px' or '15%' */
  width?: string;
  /** Render the row cell */
  cell: (row: T, index: number) => ReactNode;
  /** Mute text in cell */
  muted?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-sm',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-bg-muted/40">
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 font-medium text-fg-muted text-[11px] tracking-wider uppercase',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.align !== 'right' && c.align !== 'center' && 'text-left',
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-fg-muted text-[13px]"
                >
                  {empty ?? 'No items'}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={rowKey(r, idx)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={cn(
                    'border-b border-border last:border-b-0 transition-colors',
                    onRowClick &&
                      'cursor-pointer hover:bg-bg-muted/40 focus:bg-bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        dense ? 'px-4 py-2' : 'px-4 py-3',
                        c.align === 'right' && 'text-right tabular-nums',
                        c.align === 'center' && 'text-center',
                        c.muted && 'text-fg-muted',
                      )}
                    >
                      {c.cell(r, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
