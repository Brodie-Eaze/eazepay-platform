import type { FC } from 'react';
import { cn } from './cn';
import { StatusPill, type StatusTone } from './StatusPill';

/**
 * Lender Route Inspector timeline. This is the showpiece view for
 * partner BD: for a single application, show the order lenders were
 * evaluated, the latency of each call, the outcome, and the reason.
 *
 * Used in: admin app detail, partner portal app detail.
 */
export interface RouteStep {
  /** Tier label, e.g. "Tier 0 — Internal (BuzzPay)" */
  tier: string;
  productName: string;
  lenderName: string;
  outcome: 'approved' | 'declined' | 'ineligible' | 'error' | 'pending';
  latencyMs?: number;
  reasonCode?: string;
  reasonDetail?: string;
  /** Optional ISO timestamp */
  at?: string;
  /** Hide actor name for tenant-scoped views (e.g. partner sees only own line) */
  blurred?: boolean;
}

const outcomeToTone = (o: RouteStep['outcome']): { tone: StatusTone; label: string } => {
  switch (o) {
    case 'approved':
      return { tone: 'success', label: 'Approved' };
    case 'declined':
      return { tone: 'danger', label: 'Declined' };
    case 'ineligible':
      return { tone: 'warning', label: 'Ineligible' };
    case 'error':
      return { tone: 'danger', label: 'Error' };
    case 'pending':
      return { tone: 'neutral', label: 'Pending' };
  }
};

export const RouteTimeline: FC<{ steps: RouteStep[]; className?: string }> = ({
  steps,
  className,
}) => (
  <div className={cn('relative pl-6', className)}>
    <div className="absolute left-[10px] top-1 bottom-1 w-px bg-border" />
    {steps.map((s, i) => {
      const meta = outcomeToTone(s.outcome);
      return (
        <div key={i} className="relative pb-5 last:pb-0">
          <span
            className={cn(
              'absolute -left-[18px] top-1.5 size-3 rounded-full ring-4 ring-bg-elevated',
              s.outcome === 'approved' && 'bg-success',
              s.outcome === 'declined' && 'bg-danger',
              s.outcome === 'ineligible' && 'bg-warning',
              s.outcome === 'error' && 'bg-danger',
              s.outcome === 'pending' && 'bg-fg-muted',
            )}
          />
          <div className="rounded-lg border border-border bg-bg-elevated p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-0.5">
                  {s.tier}
                </div>
                <div className="text-[14px] font-medium">
                  {s.blurred ? '———' : s.lenderName}{' '}
                  <span className="text-fg-muted font-normal">· {s.productName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill tone={meta.tone} dot>
                  {meta.label}
                </StatusPill>
                {typeof s.latencyMs === 'number' && (
                  <span className="text-[12px] text-fg-muted tabular-nums">{s.latencyMs} ms</span>
                )}
              </div>
            </div>
            {(s.reasonCode || s.reasonDetail) && (
              <div className="mt-2 text-[12px] text-fg-secondary leading-relaxed">
                {s.reasonCode && (
                  <span className="font-mono text-[11px] bg-bg-muted rounded px-1.5 py-0.5 mr-2">
                    {s.reasonCode}
                  </span>
                )}
                {s.reasonDetail}
              </div>
            )}
            {s.at && <div className="mt-2 text-[11px] text-fg-muted tabular-nums">{s.at}</div>}
          </div>
        </div>
      );
    })}
  </div>
);
