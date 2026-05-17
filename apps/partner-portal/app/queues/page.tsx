'use client';
import { useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button as _Button,
  BoltIcon,
  ArrowRightIcon,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';

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

/**
 * Infrastructure → Queues. BullMQ queue inspector — depth, retries,
 * worker health. Reads from the workers service stats endpoint when
 * wired; until then this surface renders deterministic seed.
 */

interface QueueRow {
  name: string;
  waiting: number;
  active: number;
  completed24h: number;
  failed24h: number;
  workers: number;
  status: 'healthy' | 'degraded' | 'stalled';
}

const QUEUES_SEED: QueueRow[] = [
  {
    name: 'application.decisioning',
    waiting: 4,
    active: 2,
    completed24h: 1284,
    failed24h: 7,
    workers: 6,
    status: 'healthy',
  },
  {
    name: 'webhook.delivery',
    waiting: 18,
    active: 4,
    completed24h: 8421,
    failed24h: 23,
    workers: 8,
    status: 'healthy',
  },
  {
    name: 'payout.dispatch',
    waiting: 0,
    active: 1,
    completed24h: 142,
    failed24h: 0,
    workers: 3,
    status: 'healthy',
  },
  {
    name: 'aan.delivery',
    waiting: 11,
    active: 1,
    completed24h: 64,
    failed24h: 2,
    workers: 2,
    status: 'healthy',
  },
  {
    name: 'kyb.reverify',
    waiting: 2,
    active: 0,
    completed24h: 18,
    failed24h: 0,
    workers: 1,
    status: 'healthy',
  },
  {
    name: 'document.archive',
    waiting: 412,
    active: 0,
    completed24h: 2104,
    failed24h: 41,
    workers: 4,
    status: 'degraded',
  },
  {
    name: 'audit.fanout',
    waiting: 0,
    active: 0,
    completed24h: 9817,
    failed24h: 0,
    workers: 2,
    status: 'healthy',
  },
  {
    name: 'lender.marketplace.sync',
    waiting: 0,
    active: 0,
    completed24h: 24,
    failed24h: 0,
    workers: 1,
    status: 'healthy',
  },
];

export default function QueuesPage() {
  const [toast, setToast] = useState<string | null>(null);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }

  const totals = QUEUES_SEED.reduce(
    (acc, q) => ({
      waiting: acc.waiting + q.waiting,
      active: acc.active + q.active,
      completed: acc.completed + q.completed24h,
      failed: acc.failed + q.failed24h,
    }),
    { waiting: 0, active: 0, completed: 0, failed: 0 },
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Queues' }]}
        title="Queues"
        description="Background job queues — BullMQ on Redis. Inspect depth, retry counts, worker health."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => flash('Stats refreshed')}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => flash('Paused all non-critical workers')}
            >
              Pause workers
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat
            label="Waiting jobs"
            value={totals.waiting.toLocaleString()}
            tone={totals.waiting > 200 ? 'warning' : 'neutral'}
          />
          <Stat label="Active jobs" value={String(totals.active)} />
          <Stat label="Completed (24h)" value={totals.completed.toLocaleString()} tone="success" />
          <Stat
            label="Failed (24h)"
            value={String(totals.failed)}
            tone={totals.failed > 50 ? 'danger' : 'neutral'}
          />
        </div>

        <Card>
          <CardHeader
            title="Queue inspector"
            description="Click a queue to drain, retry failed jobs, or scale workers."
          />
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-4">Queue</span>
              <span className="col-span-1 text-right">Waiting</span>
              <span className="col-span-1 text-right">Active</span>
              <span className="col-span-2 text-right">24h done</span>
              <span className="col-span-1 text-right">24h fail</span>
              <span className="col-span-1 text-right">Workers</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-1 text-right">Action</span>
            </div>
            <ul className="divide-y divide-border">
              {QUEUES_SEED.map((q) => {
                const tone =
                  q.status === 'healthy'
                    ? 'success'
                    : q.status === 'degraded'
                      ? 'warning'
                      : 'danger';
                return (
                  <li key={q.name} className="grid grid-cols-12 items-center px-5 py-3 text-[12px]">
                    <div className="col-span-4 font-mono text-fg">{q.name}</div>
                    <div className="col-span-1 text-right tabular-nums">
                      {q.waiting.toLocaleString()}
                    </div>
                    <div className="col-span-1 text-right tabular-nums">{q.active}</div>
                    <div className="col-span-2 text-right tabular-nums text-fg-secondary">
                      {q.completed24h.toLocaleString()}
                    </div>
                    <div className="col-span-1 text-right tabular-nums text-danger">
                      {q.failed24h}
                    </div>
                    <div className="col-span-1 text-right tabular-nums">{q.workers}</div>
                    <div className="col-span-1">
                      <StatusPill tone={tone as 'success' | 'warning' | 'danger'} dot>
                        {q.status}
                      </StatusPill>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() =>
                          flash(
                            `Retried ${q.failed24h} failed job${q.failed24h === 1 ? '' : 's'} in ${q.name}`,
                          )
                        }
                        className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                      >
                        Retry <ArrowRightIcon size={10} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </PageBody>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2">
          <BoltIcon size={14} />
          {toast}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warning' | 'neutral';
}) {
  const accent =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tracking-tight leading-none ${accent}`}>
        {value}
      </p>
    </div>
  );
}
