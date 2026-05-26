'use client';
import { useCallback, useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  Money,
  InfoIcon,
  DocIcon,
  DollarIcon,
  SettingsIcon,
  RouteIcon,
  ChevronDownIcon,
} from '@eazepay/ui/web';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { currentMonthlyPeriod, stepPeriod, type Period } from '../../lib/billing-period';
import { previewGenerate, runGenerate, averageActiveFeePct } from '../../lib/billing-generator';
import { readInvoiceOverrides } from '../../lib/invoicing';
import { MonthlyBillingTab } from './_components/MonthlyBillingTab';
import { CollectionsTab } from './_components/CollectionsTab';
import { AutomationTab } from './_components/AutomationTab';

/**
 * Billing — AUREAN-pattern 3-tab workspace.
 *
 *   Monthly Billing — period-scoped invoice list, with "Generate
 *                     from activity" as the primary action.
 *   Collections    — dunning lane across all periods, grouped by
 *                     stage (Reminder 1 → Reminder 2 → Collections
 *                     → Escalated).
 *   Automation     — per-merchant billing config + schedule preview.
 *
 * Period state lives here; "Generate" derives draft invoices from
 * the settlement source for the active period. Send composer mints
 * a confirm/dispute token + injects the configured pay-link.
 */

const ACTOR = 'admin@eaze.test';

type TabId = 'monthly' | 'collections' | 'automation';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'monthly', label: 'Monthly Billing', icon: <DocIcon size={14} /> },
  { id: 'collections', label: 'Collections', icon: <DollarIcon size={14} /> },
  { id: 'automation', label: 'Automation', icon: <SettingsIcon size={14} /> },
];

export default function InvoicesPage() {
  const [period, setPeriod] = useState<Period>(() => currentMonthlyPeriod());
  const [tab, setTab] = useState<TabId>('monthly');
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [confirmingGenerate, setConfirmingGenerate] = useState(false);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  /* ─── Period header metrics ──────────────────────────────────── */

  const headerStats = useMemo(() => {
    const overrides = readInvoiceOverrides();
    const prefix = `INV-${period.id}-`;
    let cash = 0;
    let due = 0;
    for (const [invoiceNo, ov] of Object.entries(overrides)) {
      if (!invoiceNo.startsWith(prefix)) continue;
      if (ov.voidedAt) continue;
      const paid = (ov.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
      cash += paid;
      if (ov.status !== 'paid') {
        const amt = typeof ov.customFeeCents === 'number' ? ov.customFeeCents : 0;
        // amt is 0 when no custom override — fall back to a re-compute
        // via the generator preview. Cheap enough at the count we have.
        due += amt;
      }
    }
    // For a more accurate "due", use the preview which knows about
    // amounts not pinned to customFeeCents (i.e. the default
    // computed fee). Subtract anything already paid.
    if (due === 0) {
      const preview = previewGenerate(period);
      // preview.totalFeeCents counts only NOT-yet-created; for an
      // accurate Due we want sum across created+not-created minus paid.
      let createdDue = 0;
      for (const m of preview.perMerchant) {
        if (m.paused) continue;
        const inv = overrides[m.invoiceNo];
        if (!inv) {
          createdDue += m.feeAmountCents;
          continue;
        }
        if (inv.voidedAt) continue;
        if (inv.status === 'paid') continue;
        const amt = typeof inv.customFeeCents === 'number' ? inv.customFeeCents : m.feeAmountCents;
        const paid = (inv.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
        createdDue += Math.max(0, amt - paid);
      }
      due = createdDue;
    }
    const avgFee = averageActiveFeePct();
    return { cash, due, avgFee };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.id, version]);

  /* ─── Generate from activity ─────────────────────────────────── */

  const preview = useMemo(() => previewGenerate(period), [period.id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = () => {
    const result = runGenerate(period, ACTOR);
    bumpVersion();
    setConfirmingGenerate(false);
    flash(
      `Generated ${pluralize(result.created.length, 'draft')} · skipped ${result.skipped.alreadyExists} existing, ${result.skipped.paused} paused`,
    );
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Billing"
        description="Platform-fee invoicing for every active merchant · accounts-team workspace"
      />
      <PageBody>
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  'inline-flex items-center gap-2 px-4 h-10 text-[13px] font-semibold transition border-b-2 -mb-px ' +
                  (active
                    ? 'border-fg text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-secondary')
                }
              >
                <span className="text-fg-muted">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'monthly' && (
          <>
            {/* Period header strip */}
            <Card className="mb-4">
              <CardBody className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriod((p) => stepPeriod(p, -1))}
                    className="size-8 rounded-md border border-border bg-bg-elevated text-fg-secondary hover:bg-bg-muted flex items-center justify-center"
                    aria-label="Previous period"
                  >
                    <ChevronDownIcon size={14} className="rotate-90" />
                  </button>
                  <div className="px-3 py-1 text-[14px] font-semibold text-fg min-w-[110px] text-center">
                    {period.label}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPeriod((p) => stepPeriod(p, 1))}
                    className="size-8 rounded-md border border-border bg-bg-elevated text-fg-secondary hover:bg-bg-muted flex items-center justify-center"
                    aria-label="Next period"
                  >
                    <ChevronDownIcon size={14} className="-rotate-90" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[13px]">
                  <span className="text-fg-muted">
                    Cash:{' '}
                    <Money cents={headerStats.cash} compact className="font-semibold text-fg" />
                  </span>
                  <span className="text-fg-muted">·</span>
                  <span className="text-fg-muted">
                    Due @ {(headerStats.avgFee * 100).toFixed(1)}%:{' '}
                    <Money
                      cents={headerStats.due}
                      compact
                      className="font-semibold text-emerald-700"
                    />
                  </span>
                  <Button size="sm" onClick={() => setConfirmingGenerate(true)}>
                    <RouteIcon size={12} />
                    Generate from activity
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card className="mb-4">
              <CardBody className="flex items-start gap-3 px-5 py-3">
                <span className="text-fg-muted mt-0.5">
                  <InfoIcon size={14} />
                </span>
                <p className="flex-1 text-[12px] text-fg-secondary leading-relaxed">
                  Invoices are built by summing each merchant's funded volume for the period and
                  applying the configured fee %. Click <strong>Generate from activity</strong> to
                  refresh drafts, then <strong>Send</strong> to email the merchant a confirm /
                  dispute link. Auto-send per merchant lives in the Automation tab.
                </p>
              </CardBody>
            </Card>

            <MonthlyBillingTab
              period={period}
              flash={flash}
              version={version}
              bumpVersion={bumpVersion}
            />
          </>
        )}

        {tab === 'collections' && (
          <CollectionsTab flash={flash} version={version} bumpVersion={bumpVersion} />
        )}

        {tab === 'automation' && (
          <AutomationTab flash={flash} version={version} bumpVersion={bumpVersion} />
        )}

        {/* Generate confirmation */}
        {confirmingGenerate && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-bg-inverse/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setConfirmingGenerate(false)}
          >
            <div className="bg-bg-elevated rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
              <h2 className="text-[16px] font-semibold text-fg">Generate from activity</h2>
              <p className="mt-1 text-[12px] text-fg-muted">{period.label}</p>
              <div className="mt-4 rounded-lg border border-border bg-bg-muted/30 p-3 text-[13px] space-y-1">
                <p>
                  Will create <strong>{pluralize(preview.toCreate, 'new draft')}</strong> totalling{' '}
                  <Money cents={preview.totalFeeCents} compact className="font-semibold" />
                </p>
                <p className="text-fg-muted">
                  Skipping {preview.alreadyExists} already-generated and{' '}
                  {pluralize(preview.paused, 'paused merchant')}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmingGenerate(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={generate} disabled={preview.toCreate === 0}>
                  Create {pluralize(preview.toCreate, 'draft')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 rounded-lg bg-fg text-bg-elevated px-4 py-3 text-[13px] font-semibold shadow-lg"
          >
            {toast}
          </div>
        )}
      </PageBody>
    </>
  );
}
