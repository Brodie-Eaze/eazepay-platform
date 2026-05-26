'use client';

/**
 * /admin/migrations/ai-funding — AI Funding → MedPay migration queue.
 *
 * The July 1 cutover workspace. Every customer closed during the
 * AI Funding launch window (May 25 → June 30) appears here. Operators
 * batch-seed the queue, then trigger migrations individually or in
 * bulk. Per-customer status, retries, and rollback are surfaced here.
 *
 * Reads `lib/orchestrator/migration.ts` via /api/admin/migrations.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  StatusPill,
  Textarea,
  EmptyState,
  Button as _Button,
  QueueIcon,
  LiveIndicator,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
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

interface StepState {
  name: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  completedAt: string | null;
  note: string | null;
}

interface MigrationRecord {
  id: string;
  sourceCustomerId: string;
  targetPartnerId: string | null;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  steps: StepState[];
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<MigrationRecord['status'], StatusTone> = {
  queued: 'neutral',
  in_progress: 'info',
  completed: 'success',
  failed: 'danger',
  rolled_back: 'warning',
};

const STATUS_LABEL: Record<MigrationRecord['status'], string> = {
  queued: 'Queued',
  in_progress: 'Migrating',
  completed: 'Completed',
  failed: 'Failed',
  rolled_back: 'Rolled back',
};

const STEP_TONE: Record<StepState['status'], StatusTone> = {
  pending: 'neutral',
  in_progress: 'info',
  done: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

const VALID_MIGRATION_STATUSES: ReadonlyArray<MigrationRecord['status']> = [
  'queued',
  'in_progress',
  'completed',
  'failed',
  'rolled_back',
];

export default function AiFundingMigrationPage(): JSX.Element {
  const [migrations, setMigrations] = useState<MigrationRecord[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  /* Sprint H: URL-driven status filter — clicking a KPI tile drills in. */
  const sp = useSearchParams();
  const statusFromUrl = sp?.get('status');
  const filter: MigrationRecord['status'] | null =
    statusFromUrl && (VALID_MIGRATION_STATUSES as readonly string[]).includes(statusFromUrl)
      ? (statusFromUrl as MigrationRecord['status'])
      : null;

  async function refresh() {
    const res = await fetch('/api/admin/migrations', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { migrations: MigrationRecord[] };
      setMigrations(data.migrations);
      setLastSuccessAt(Date.now());
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    return {
      queued: migrations.filter((m) => m.status === 'queued').length,
      in_progress: migrations.filter((m) => m.status === 'in_progress').length,
      completed: migrations.filter((m) => m.status === 'completed').length,
      failed: migrations.filter((m) => m.status === 'failed').length,
    };
  }, [migrations]);

  async function seedBulk() {
    setBusy(true);
    const ids = seedInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setBusy(false);
      return;
    }
    await fetch('/api/admin/migrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceCustomerIds: ids }),
    });
    setSeedInput('');
    await refresh();
    setBusy(false);
  }

  async function startOne(id: string) {
    await fetch(`/api/admin/migrations/${id}`, { method: 'POST' });
    await refresh();
  }

  async function startAllQueued() {
    setBusy(true);
    const queued = migrations.filter((m) => m.status === 'queued');
    await Promise.all(
      queued.map((m) => fetch(`/api/admin/migrations/${m.id}`, { method: 'POST' })),
    );
    await refresh();
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'AI Funding migrations' }]}
        title="Migrate customers to MedPay"
        description="The July 1 cutover. Walk every AI Funding customer onto the MedPay infrastructure."
        meta={
          <StatusPill tone="warning" dot>
            July 1 cutover · Migration queue
          </StatusPill>
        }
        actions={<LiveIndicator pulseKey={lastSuccessAt ?? 0} />}
      />
      <PageBody>
        {/* Sprint H: each KPI is a clickable drill-in. URL is source of
            truth — list below filters via `filter`. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Link
            href="?status=queued"
            aria-label={`Queued: ${counts.queued} migrations. Filter list.`}
            title="Customers waiting to be migrated from AI Funding onto MedPay"
            className="block rounded-lg hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <KpiCard label="Queued" value={counts.queued} />
          </Link>
          <Link
            href="?status=in_progress"
            aria-label={`Migrating: ${counts.in_progress} migrations. Filter list.`}
            title="Customers currently being walked through the migration steps"
            className="block rounded-lg hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <KpiCard label="Migrating" value={counts.in_progress} />
          </Link>
          <Link
            href="?status=completed"
            aria-label={`Completed: ${counts.completed} migrations. Filter list.`}
            title="Customers fully cut over to MedPay"
            className="block rounded-lg hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <KpiCard label="Completed" value={counts.completed} />
          </Link>
          <Link
            href="?status=failed"
            aria-label={`Failed: ${counts.failed} migrations. Filter list.`}
            title="Customers whose migration errored — open to retry or rollback"
            className="block rounded-lg hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <KpiCard label="Failed" value={counts.failed} />
          </Link>
        </div>

        <Card className="mb-5">
          <CardHeader
            title="Seed migration queue"
            description="Paste AI Funding customer ids (one per line or comma-separated) to queue them for migration."
          />
          <CardBody>
            <Textarea
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder={'ai_cust_001\nai_cust_002\nai_cust_003'}
              className="font-mono text-[12px]"
              aria-label="AI Funding customer ids to queue"
            />
            <div className="flex gap-2.5 mt-3 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={seedBulk}
                disabled={busy || !seedInput.trim()}
              >
                Queue migrations
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={startAllQueued}
                disabled={busy || counts.queued === 0}
              >
                Start all queued ({counts.queued})
              </Button>
            </div>
          </CardBody>
        </Card>

        {(() => {
          const filteredList =
            filter === null ? migrations : migrations.filter((m) => m.status === filter);
          if (migrations.length === 0) {
            return (
              <EmptyState
                icon={<QueueIcon size={20} />}
                title="No migrations yet"
                description="Seed the queue above with AI Funding customer ids to get started."
              />
            );
          }
          if (filteredList.length === 0) {
            return (
              <EmptyState
                icon={<QueueIcon size={20} />}
                title={`No ${filter ? STATUS_LABEL[filter].toLowerCase() : ''} migrations`}
                description={
                  <>
                    <Link
                      href="?"
                      className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm"
                    >
                      Clear filter
                    </Link>{' '}
                    to see all migrations.
                  </>
                }
              />
            );
          }
          return (
            <div className="grid gap-2.5">
              {filteredList.map((m) => (
                <Card key={m.id}>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_2fr_auto] gap-4 md:gap-5 items-center">
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-fg truncate">
                          {m.sourceCustomerId}
                        </div>
                        <div className="text-[11.5px] text-fg-muted mt-0.5">
                          {m.targetPartnerId
                            ? `→ ${m.targetPartnerId}`
                            : 'pending partner creation'}
                        </div>
                      </div>
                      <div>
                        <StatusPill tone={STATUS_TONE[m.status]} dot>
                          {STATUS_LABEL[m.status]}
                        </StatusPill>
                        {m.failureReason && (
                          <div className="mt-1.5 text-[11px] text-danger">{m.failureReason}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.steps.map((s) => (
                          <StatusPill
                            key={s.name}
                            tone={STEP_TONE[s.status]}
                            className="text-[10.5px] px-2 py-0"
                          >
                            <span title={`${s.name}: ${s.status}${s.note ? ` — ${s.note}` : ''}`}>
                              {s.name.replace(/_/g, ' ')}
                            </span>
                          </StatusPill>
                        ))}
                      </div>
                      <div className="md:justify-self-end">
                        {m.status === 'queued' ? (
                          <Button variant="primary" size="sm" onClick={() => startOne(m.id)}>
                            Start
                          </Button>
                        ) : (
                          <span className="text-[11.5px] text-fg-muted tabular-nums">
                            {m.startedAt ? new Date(m.startedAt).toLocaleTimeString() : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          );
        })()}
      </PageBody>
    </>
  );
}
