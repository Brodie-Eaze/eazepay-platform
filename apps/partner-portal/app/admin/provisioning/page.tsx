'use client';

/**
 * /admin/provisioning — Provisioning queue
 *
 * Live view of every one-config provisioning run on the platform.
 * Polls /api/onboarding/provision every 3s for status updates.
 *
 * Driven by `lib/orchestrator/provision.ts` — each row represents
 * a partner being walked through HighSale → Marketplace defaults →
 * MiCamp → Partner-portal seed in sequence.
 *
 * Operators use this page to:
 *   • Watch new partner onboardings complete in real-time
 *   • Spot failed runs and which step blew up
 *   • Drill into a single run's per-step result payload
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button as _Button,
  StatusPill,
  EmptyState,
  Filter,
  ArrowRightIcon,
  QueueIcon,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
  type FilterOption,
} from '@eazepay/ui/web';
import type { ProvisionRun, StepStatus } from '@/lib/orchestrator/provision';

/* `null` represents the "All" pseudo-filter — see canonical <Filter>. */
type StatusFilter = ProvisionRun['status'] | null;

/* Locally-typed Button wrapper — matches the pattern in control-panel/page.tsx
 * so strict TS JSX inference picks up `children`. */
type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

const STATUS_TONE: Record<ProvisionRun['status'], StatusTone> = {
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<ProvisionRun['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const STEP_TONE: Record<StepStatus, StatusTone> = {
  pending: 'neutral',
  in_progress: 'info',
  done: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

const STEP_LABEL: Record<string, string> = {
  highsale_subaccount: 'HighSale',
  marketplace_defaults: 'Marketplace',
  micamp_mid: 'MiCamp',
  partner_portal_seed: 'Portal Seed',
};

export default function ProvisioningQueuePage(): JSX.Element {
  const [runs, setRuns] = useState<ProvisionRun[]>([]);
  const [filter, setFilter] = useState<StatusFilter>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/onboarding/provision', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { runs: ProvisionRun[] };
        if (!cancelled) {
          setRuns(data.runs);
          setLoading(false);
        }
      } catch {
        /* swallow — next poll will retry */
      }
    }
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === null) return runs;
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  const counts = useMemo(() => {
    return {
      all: runs.length,
      queued: runs.filter((r) => r.status === 'queued').length,
      running: runs.filter((r) => r.status === 'running').length,
      completed: runs.filter((r) => r.status === 'completed').length,
      failed: runs.filter((r) => r.status === 'failed').length,
    };
  }, [runs]);

  const filterOptions: FilterOption<ProvisionRun['status']>[] = [
    { value: 'queued', label: STATUS_LABEL.queued, count: counts.queued },
    { value: 'running', label: STATUS_LABEL.running, count: counts.running },
    { value: 'completed', label: STATUS_LABEL.completed, count: counts.completed },
    { value: 'failed', label: STATUS_LABEL.failed, count: counts.failed },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Provisioning' }]}
        title="Provisioning queue"
        description="Every partner being walked through HighSale → Marketplace → MiCamp → Portal seed. Updates every 3 seconds. Click into a run for the per-step result payload."
        actions={
          <Link
            href="/admin/provisioning/new"
            className="inline-flex"
            aria-label="New provisioning run"
          >
            <Button size="sm" variant="primary">
              New provisioning run
            </Button>
          </Link>
        }
      />
      <PageBody>
        <div className="mb-5">
          <Filter<ProvisionRun['status']>
            variant="tabs"
            label="Status"
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            allLabel={`All (${counts.all})`}
          />
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="py-12 text-center text-[13px] text-fg-muted"
          >
            Loading runs…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<QueueIcon size={20} />}
            title="No runs match this filter"
            description={
              <>
                Kick off a provisioning run via{' '}
                <code className="font-mono">POST /api/onboarding/provision</code> or click “New
                provisioning run”.
              </>
            }
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map((run) => (
              <Link
                key={run.id}
                href={`/admin/provisioning/${run.id}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-lg"
                aria-label={`Open provisioning run ${run.id}`}
              >
                <Card className="transition-colors hover:border-border-strong">
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_2fr_auto] gap-4 md:gap-6 items-center">
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-fg truncate">
                          {run.partnerId}
                        </div>
                        <div className="text-[11.5px] text-fg-muted mt-0.5">
                          {run.brand.toUpperCase()} · {new Date(run.startedAt).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <StatusPill tone={STATUS_TONE[run.status]} dot>
                          {STATUS_LABEL[run.status]}
                        </StatusPill>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {run.steps.map((s) => (
                          <StatusPill
                            key={s.name}
                            tone={STEP_TONE[s.status]}
                            className="text-[10.5px] px-2 py-0"
                          >
                            <span
                              title={`${STEP_LABEL[s.name] ?? s.name}: ${s.status}${s.note ? ` — ${s.note}` : ''}`}
                            >
                              {STEP_LABEL[s.name] ?? s.name}
                            </span>
                          </StatusPill>
                        ))}
                      </div>
                      <div className="text-accent" aria-hidden>
                        <ArrowRightIcon size={16} />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
