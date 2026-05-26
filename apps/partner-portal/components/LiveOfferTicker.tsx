'use client';
import { useCallback, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, StatusPill } from '@eazepay/ui/web';
import { formatBps } from '@eazepay/shared-utils/format-bps';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { useEventStream, type EventEnvelope } from '../lib/event-stream';

/**
 * Per-application live offer ticker.
 *
 * Subscribes to /v1/applications/<id>/stream (partner-scoped SSE)
 * and renders offers as each lender responds. Empty state shows a
 * "Waiting for offers… N of 52 lenders quoted" progress while
 * orchestration runs.
 *
 * Sound: a soft chime plays the first time `offer_received` lands
 * (one-shot per page load) so a rep on the phone hears the moment
 * the first offer arrives.
 *
 * PII: the ticker renders APR, term, monthly, amount, fees, status —
 * never the applicant's SSN / DOB / address. Those live in the
 * existing application-detail panels (PII-masked + JIT-unmask
 * available via ADR-0017).
 */

interface LenderRow {
  lender: string;
  status: 'quoting' | 'offered' | 'declined' | 'errored';
  aprBps?: number;
  termMonths?: number;
  amountCents?: number;
  monthlyCents?: number;
  feesCents?: number;
  totalRepayableCents?: number;
  receivedAt: string;
}

function fmtPct(bps?: number): string {
  return bps == null ? '—' : formatBps(bps);
}
function fmtCents(c?: number): string {
  return c == null ? '—' : formatCurrencyCents(c);
}

function reduceOffers(events: EventEnvelope[]): LenderRow[] {
  const byLender = new Map<string, LenderRow>();
  for (const e of events) {
    if (e.kind !== 'offer_received' && e.kind !== 'offer_selected') continue;
    const p = e.payload as Record<string, unknown>;
    const lender = String(p.lender ?? '');
    if (!lender) continue;
    const row: LenderRow = byLender.get(lender) ?? {
      lender,
      status: 'quoting',
      receivedAt: e.at,
    };
    if (e.kind === 'offer_received') {
      const status = p.status as LenderRow['status'] | undefined;
      row.status = status ?? 'offered';
      if (typeof p.aprBps === 'number') row.aprBps = p.aprBps;
      if (typeof p.termMonths === 'number') row.termMonths = p.termMonths;
      if (typeof p.amountCents === 'number') row.amountCents = p.amountCents;
      if (typeof p.monthlyCents === 'number') row.monthlyCents = p.monthlyCents;
      if (typeof p.feesCents === 'number') row.feesCents = p.feesCents;
      if (typeof p.totalRepayableCents === 'number')
        row.totalRepayableCents = p.totalRepayableCents;
      row.receivedAt = e.at;
    }
    byLender.set(lender, row);
  }
  return [...byLender.values()].sort((a, b) => {
    // Status priority: offered first (best terms first), then quoting,
    // then declined / errored.
    const sa = a.status === 'offered' ? 0 : a.status === 'quoting' ? 1 : 2;
    const sb = b.status === 'offered' ? 0 : b.status === 'quoting' ? 1 : 2;
    if (sa !== sb) return sa - sb;
    return (a.totalRepayableCents ?? Infinity) - (b.totalRepayableCents ?? Infinity);
  });
}

export function LiveOfferTicker({
  applicationId,
  totalLenders = 52,
}: {
  applicationId: string;
  totalLenders?: number;
}) {
  const [muted, setMuted] = useState(false);

  const playChime = useCallback(() => {
    if (muted) return;
    if (typeof window === 'undefined') return;
    // Tiny synthesised tone — avoids shipping an audio asset.
    // Webaudio is one-shot, no dependencies.
    try {
      const Ctx =
        (
          window as unknown as {
            AudioContext?: typeof AudioContext;
            webkitAudioContext?: typeof AudioContext;
          }
        ).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch {
      /* audio blocked / unavailable — non-fatal */
    }
  }, [muted]);

  const { events, connected, reconnects } = useEventStream(
    { kind: 'application', applicationId },
    {
      bufferSize: 200,
      firstMatchPredicate: (e) => e.kind === 'offer_received',
      onFirstMatch: playChime,
    },
  );

  const rows = useMemo(() => reduceOffers(events), [events]);
  const offered = rows.filter((r) => r.status === 'offered').length;
  const quoting = rows.filter((r) => r.status === 'quoting').length;
  const responded = rows.length;
  const pct = totalLenders > 0 ? Math.round((responded / totalLenders) * 100) : 0;

  return (
    <Card className="mb-4">
      <CardHeader
        title="Live offers"
        description={
          responded === 0
            ? `Waiting for offers… ${responded} of ${pluralize(totalLenders, 'lender')} quoted.`
            : `${pluralize(offered, 'offer')} · ${quoting} quoting · ${responded} of ${totalLenders} responded`
        }
        action={
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={
                  'size-2 rounded-full ' +
                  (connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')
                }
                aria-hidden
              />
              <span className="text-fg-muted">
                {connected
                  ? 'Live'
                  : reconnects > 0
                    ? `Reconnecting… (#${reconnects})`
                    : 'Connecting…'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="text-fg-muted hover:text-fg underline-offset-2 hover:underline"
              aria-label={muted ? 'Unmute new-offer chime' : 'Mute new-offer chime'}
            >
              {muted ? '🔇 muted' : '🔔 sound on'}
            </button>
          </div>
        }
      />
      <CardBody className="p-0">
        {/* Progress bar — shows lender-coverage at a glance. */}
        <div
          className="h-1 bg-bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-fg-muted text-[13px]">
            <p>Submitting to {totalLenders} lenders in parallel…</p>
            <p className="text-[11px] mt-1">Offers will appear here as each lender responds.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Live offers" tabIndex={0}>
            <div className="min-w-[640px]">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
                <span className="col-span-3">Lender</span>
                <span className="col-span-1 text-right">APR</span>
                <span className="col-span-1 text-right">Term</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-2 text-right">Monthly</span>
                <span className="col-span-2 text-right">Total repayable</span>
                <span className="col-span-1 text-right">Status</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li
                    key={r.lender}
                    className={
                      'grid grid-cols-12 items-center px-5 py-2.5 text-[12px] ' +
                      (r.status === 'offered' ? '' : 'opacity-70')
                    }
                  >
                    <span className="col-span-3 font-semibold truncate">{r.lender}</span>
                    <span className="col-span-1 text-right tabular-nums">{fmtPct(r.aprBps)}</span>
                    <span className="col-span-1 text-right tabular-nums">
                      {r.termMonths ?? '—'}
                    </span>
                    <span className="col-span-2 text-right tabular-nums">
                      {fmtCents(r.amountCents)}
                    </span>
                    <span className="col-span-2 text-right tabular-nums">
                      {fmtCents(r.monthlyCents)}
                    </span>
                    <span className="col-span-2 text-right tabular-nums font-semibold">
                      {fmtCents(r.totalRepayableCents)}
                    </span>
                    <span className="col-span-1 text-right">
                      <StatusPill
                        tone={
                          r.status === 'offered'
                            ? 'success'
                            : r.status === 'quoting'
                              ? 'warning'
                              : r.status === 'declined'
                                ? 'neutral'
                                : 'danger'
                        }
                      >
                        {r.status}
                      </StatusPill>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
