'use client';
import { useMemo, useState } from 'react';
import { Button } from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../../lib/master-data';
import {
  getBillingConfig,
  setBillingConfig,
  type BillingCycle,
  type BillingConfig,
} from '../../../lib/billing-config';
import { nextRunDate } from '../../../lib/billing-period';
import { effectiveFeePct } from '../../../lib/invoicing';

const fieldCn =
  'w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-border-focus';
const selectCn = fieldCn + ' pr-7';

interface Props {
  flash: (m: string) => void;
  version: number;
  bumpVersion: () => void;
}

const CYCLE_OPTIONS: Array<{ value: BillingCycle; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'paused', label: 'Paused' },
];

const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AutomationTab({ flash, version, bumpVersion }: Props) {
  const today = new Date();
  const rows = useMemo(
    () =>
      MASTER_PARTNERS.map((p) => {
        const cfg = getBillingConfig(p.id);
        return {
          partner: p,
          cfg,
          feePct: effectiveFeePct(p.id, p.product),
          nextRun: nextRunDate(cfg.cycle, cfg.dayOfPeriod, today),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const activeCount = rows.filter((r) => r.cfg.cycle !== 'paused').length;
  const pausedCount = rows.filter((r) => r.cfg.cycle === 'paused').length;
  const autoSendCount = rows.filter((r) => r.cfg.autoSend).length;
  const withPayLink = rows.filter((r) => r.cfg.paymentLinkTemplate).length;

  const update = (partnerId: string, patch: Partial<BillingConfig>) => {
    const cur = getBillingConfig(partnerId);
    setBillingConfig({ ...cur, ...patch, partnerId });
    bumpVersion();
  };

  return (
    <>
      {/* Top summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Active billing configs" value={`${activeCount}`} hint="will be invoiced" />
        <Stat label="Paused" value={`${pausedCount}`} hint="excluded from runs" />
        <Stat
          label="Auto-send enabled"
          value={`${autoSendCount}`}
          hint="drafts → sent on generate"
        />
        <Stat
          label="Pay-link configured"
          value={`${withPayLink}`}
          hint="composer drops Pay button"
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-border bg-bg-muted/30 text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
          <span className="col-span-3">Merchant</span>
          <span className="col-span-2">Cycle</span>
          <span className="col-span-1">Day</span>
          <span className="col-span-2">Next run</span>
          <span className="col-span-1 text-right">Fee %</span>
          <span className="col-span-2">Send-to</span>
          <span className="col-span-1 text-right">Auto-send</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map(({ partner: p, cfg, feePct, nextRun }) => (
            <li key={p.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center">
              <div className="col-span-3 min-w-0">
                <p className="text-[13px] font-semibold text-fg truncate">{p.legalName}</p>
                <p className="text-[11px] text-fg-muted truncate">
                  {p.product} · {p.id}
                </p>
              </div>
              <div className="col-span-2">
                <select
                  value={cfg.cycle}
                  onChange={(e) => update(p.id, { cycle: e.target.value as BillingCycle })}
                  className={selectCn}
                  aria-label={`Cycle for ${p.legalName}`}
                >
                  {CYCLE_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                {cfg.cycle === 'paused' ? (
                  <span className="text-[11px] text-fg-muted">—</span>
                ) : cfg.cycle === 'weekly' ? (
                  <select
                    value={cfg.dayOfPeriod}
                    onChange={(e) => update(p.id, { dayOfPeriod: Number(e.target.value) })}
                    className={selectCn}
                    aria-label={`Day of week for ${p.legalName}`}
                  >
                    {WEEKDAY_LABEL.map((w, i) => (
                      <option key={i} value={i}>
                        {w}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={cfg.dayOfPeriod}
                    onChange={(e) =>
                      update(p.id, {
                        dayOfPeriod: Math.min(28, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                    className={fieldCn + ' tabular-nums'}
                    aria-label={`Day of month for ${p.legalName}`}
                  />
                )}
              </div>
              <div className="col-span-2 text-[12px] text-fg-secondary tabular-nums">
                {nextRun ? nextRun : <span className="text-fg-muted italic">paused</span>}
              </div>
              <div className="col-span-1 text-right tabular-nums text-[12px] text-fg-secondary">
                {(feePct * 100).toFixed(1)}%
              </div>
              <div className="col-span-2">
                <input
                  type="email"
                  value={cfg.sendToEmail ?? ''}
                  onChange={(e) => update(p.id, { sendToEmail: e.target.value || undefined })}
                  placeholder={p.email}
                  className={fieldCn}
                  aria-label={`Send-to email for ${p.legalName}`}
                />
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={cfg.autoSend}
                    onChange={(e) => update(p.id, { autoSend: e.target.checked })}
                  />
                  <span className="text-fg-muted">auto</span>
                </label>
              </div>
              <div className="col-span-12">
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-fg-muted mt-1">
                  Payment-link template
                  <input
                    type="text"
                    value={cfg.paymentLinkTemplate ?? ''}
                    onChange={(e) =>
                      update(p.id, { paymentLinkTemplate: e.target.value || undefined })
                    }
                    placeholder="https://pay.stripe.com/inv/{{invoice}}?amount={{amount}}  (or any URL)"
                    className={fieldCn + ' mt-1 font-mono text-[11px]'}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-[12px] text-fg-muted leading-relaxed">
        Cycle <strong>Monthly</strong> bills on the configured day each month;{' '}
        <strong>Weekly</strong> on the configured weekday. <strong>Paused</strong> excludes the
        merchant from "Generate from activity" runs. <strong>Auto-send</strong> flips generated
        drafts to Sent and queues the email. <strong>Payment-link template</strong> supports{' '}
        <code className="font-mono text-[11px] bg-bg-muted px-1 rounded">{'{{invoice}}'}</code> and{' '}
        <code className="font-mono text-[11px] bg-bg-muted px-1 rounded">{'{{amount}}'}</code>{' '}
        placeholders; the Send composer drops the resolved URL into the email body as a "Pay now"
        CTA.
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-border bg-bg-muted/30 p-4 text-[12px] text-fg-secondary">
        <p className="font-semibold text-fg mb-1">Phase B — credentials needed</p>
        <p>
          Real email delivery via Resend, Stripe-issued payment links + payment-succeeded webhook,
          and a Railway cron to fire scheduled runs all require API keys. Set{' '}
          <code className="font-mono text-[11px]">RESEND_API_KEY</code>,{' '}
          <code className="font-mono text-[11px]">STRIPE_SECRET_KEY</code>, and the cron
          configuration; the data model above is already shaped to drive them.
        </p>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-fg-muted">{hint}</p>}
    </div>
  );
}
