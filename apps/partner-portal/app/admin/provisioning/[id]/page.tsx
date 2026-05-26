'use client';

/**
 * /admin/provisioning/[id] — Single provisioning run detail
 *
 * Per-step view of a one-config provisioning run. Polls
 * /api/onboarding/provision/[id] every 2s until the run reaches a
 * terminal state.
 *
 * For each step we surface:
 *   • Status (pending → in_progress → done | failed | skipped)
 *   • Start + complete timestamps
 *   • Note (human-readable status detail)
 *   • Result payload (raw JSON, for debugging failed runs)
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  StatusPill,
  Banner,
  ClockIcon,
  CheckIcon,
  type StatusTone,
} from '@eazepay/ui/web';
import type { ProvisionRun, StepStatus } from '@/lib/orchestrator/provision';

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

const STEP_LABEL_STATUS: Record<StepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
};

const STEP_LABEL: Record<string, string> = {
  highsale_subaccount: 'HighSale sub-account',
  marketplace_defaults: 'Lender marketplace defaults',
  micamp_mid: 'MiCamp MID (pre-underwriting)',
  partner_portal_seed: 'Partner portal seed',
};

export default function ProvisioningRunPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [run, setRun] = useState<ProvisionRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/onboarding/provision/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          setError(
            `We couldn't find onboarding run ${id}. It may have been archived — check the list.`,
          );
          return;
        }
        const data = (await res.json()) as ProvisionRun;
        if (!cancelled) {
          setRun(data);
          if (data.status === 'completed' || data.status === 'failed') {
            return; // stop polling
          }
        }
      } catch {
        /* swallow */
      }
    }
    void poll();
    const interval = setInterval(() => {
      if (run?.status === 'completed' || run?.status === 'failed') return;
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, run?.status]);

  if (error) {
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Provisioning', href: '/admin/provisioning' },
            { label: id ?? 'Run' },
          ]}
          title="Onboarding run not found"
        />
        <PageBody>
          <Banner intent="danger" title="Onboarding run not found">
            {error}
          </Banner>
        </PageBody>
      </>
    );
  }

  if (!run) {
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Provisioning', href: '/admin/provisioning' },
            { label: id ?? '…' },
          ]}
          title="Loading onboarding run…"
        />
        <PageBody>
          <div
            role="status"
            aria-live="polite"
            className="py-12 text-center text-[13px] text-fg-muted"
          >
            Loading run…
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Provisioning', href: '/admin/provisioning' },
          { label: run.id },
        ]}
        title={`Onboarding · ${run.partnerId}`}
        description={`Step-by-step view of ${run.partnerId}'s onboarding.`}
        meta={
          <>
            <StatusPill tone={STATUS_TONE[run.status]} dot>
              {STATUS_LABEL[run.status]}
            </StatusPill>
            <span className="text-fg-muted text-[12px]">
              Started {new Date(run.startedAt).toLocaleString()}
            </span>
            {run.completedAt && (
              <span className="text-fg-muted text-[12px]">
                · Completed {new Date(run.completedAt).toLocaleString()}
              </span>
            )}
          </>
        }
      />
      <PageBody>
        {run.failureReason && (
          <Banner intent="danger" title="Failure" className="mb-5">
            {run.failureReason}
          </Banner>
        )}

        <div className="grid gap-3.5">
          {run.steps.map((step, idx) => {
            const tone = STEP_TONE[step.status];
            return (
              <Card key={step.name}>
                <CardHeader
                  title={
                    <div className="flex flex-col gap-1">
                      <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-fg-muted">
                        Step {idx + 1}
                      </div>
                      <div className="text-[16px] font-semibold text-fg">
                        {STEP_LABEL[step.name] ?? step.name}
                      </div>
                    </div>
                  }
                  action={
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusPill tone={tone} dot>
                        {STEP_LABEL_STATUS[step.status]}
                      </StatusPill>
                      <div className="text-[11.5px] text-fg-muted text-right space-y-0.5">
                        {step.startedAt && (
                          <div className="inline-flex items-center gap-1">
                            <ClockIcon size={11} aria-hidden />
                            {new Date(step.startedAt).toLocaleTimeString()}
                          </div>
                        )}
                        {step.completedAt && (
                          <div className="inline-flex items-center gap-1">
                            <CheckIcon size={11} aria-hidden />
                            {new Date(step.completedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  }
                />
                {(step.note || step.result) && (
                  <CardBody>
                    {step.note && (
                      <div className="text-[13.5px] text-fg-secondary mb-3">{step.note}</div>
                    )}
                    {step.result && (
                      <details className="group">
                        <summary className="cursor-pointer text-[12px] font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded">
                          Result payload
                        </summary>
                        <pre className="mt-2.5 p-3 bg-bg-muted text-fg-secondary rounded-md text-[11.5px] overflow-x-auto font-mono">
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </details>
                    )}
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
