'use client';
import { useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  SearchIcon,
  ArrowRightIcon,
  type StatusTone,
} from '@eazepay/ui/web';

/**
 * Domain event bus — live tail. Filterable by type, actor, target.
 */

interface EventRow {
  id: string;
  ts: string;
  type: string;
  actor: string;
  target: string;
  outcome: 'success' | 'failed' | 'pending';
}

const EVENT_SEED: EventRow[] = [
  {
    id: 'ev_001',
    ts: '2026-05-14T22:18:14Z',
    type: 'partner.suspended',
    actor: 'Brodie',
    target: 'p_riverside',
    outcome: 'success',
  },
  {
    id: 'ev_002',
    ts: '2026-05-14T22:17:08Z',
    type: 'application.funded',
    actor: 'System',
    target: 'a_034',
    outcome: 'success',
  },
  {
    id: 'ev_003',
    ts: '2026-05-14T22:14:55Z',
    type: 'webhook.delivered',
    actor: 'System',
    target: 'whk_evergreen',
    outcome: 'success',
  },
  {
    id: 'ev_004',
    ts: '2026-05-14T22:12:01Z',
    type: 'application.decisioned',
    actor: 'Risk Bot',
    target: 'a_034 approved',
    outcome: 'success',
  },
  {
    id: 'ev_005',
    ts: '2026-05-14T22:11:42Z',
    type: 'lender.routed',
    actor: 'Orchestrator',
    target: 'CapitalOne',
    outcome: 'success',
  },
  {
    id: 'ev_006',
    ts: '2026-05-14T22:09:18Z',
    type: 'application.submitted',
    actor: 'Sarah Park',
    target: 'a_034 (p_atlas)',
    outcome: 'success',
  },
  {
    id: 'ev_007',
    ts: '2026-05-14T21:54:02Z',
    type: 'webhook.delivery_failed',
    actor: 'System',
    target: 'whk_evergreen',
    outcome: 'failed',
  },
  {
    id: 'ev_008',
    ts: '2026-05-14T21:48:33Z',
    type: 'payout.scheduled',
    actor: 'System',
    target: '$258,300 -> p_atlas',
    outcome: 'success',
  },
  {
    id: 'ev_009',
    ts: '2026-05-14T21:31:09Z',
    type: 'lender.override.toggle',
    actor: 'Brodie',
    target: 'SageHeal off · p_helio',
    outcome: 'success',
  },
  {
    id: 'ev_010',
    ts: '2026-05-14T21:14:51Z',
    type: 'kyb.reverify',
    actor: 'Compliance Bot',
    target: 'p_orion',
    outcome: 'success',
  },
  {
    id: 'ev_011',
    ts: '2026-05-14T20:58:22Z',
    type: 'team.member.invite',
    actor: 'Brodie',
    target: 'casey.reed@partner',
    outcome: 'pending',
  },
  {
    id: 'ev_012',
    ts: '2026-05-14T20:42:11Z',
    type: 'application.declined',
    actor: 'Risk Bot',
    target: 'a_033 DTI > 50%',
    outcome: 'success',
  },
];

export default function EventsPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return EVENT_SEED;
    const q = search.toLowerCase();
    return EVENT_SEED.filter(
      (e) =>
        e.type.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q),
    );
  }, [search]);

  const tone: Record<EventRow['outcome'], StatusTone> = {
    success: 'success',
    failed: 'danger',
    pending: 'warning',
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Events' }]}
        title="Events"
        description="Live tail of the domain event bus — filterable by type, actor, and target. EventBridge in prod, in-process emitter in dev."
        meta={
          <StatusPill tone="success" dot>
            Stream live · {EVENT_SEED.length} events in last 30 min
          </StatusPill>
        }
      />
      <PageBody>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Filter type, actor, or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <span className="text-[11px] text-fg-muted">
            {filtered.length} event{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <Card>
          <CardHeader title="Event stream" description="Newest first." />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-12 items-center px-5 py-3 text-[12px] hover:bg-bg-muted/30"
                >
                  <div className="col-span-2 font-mono text-[11px] text-fg-muted">
                    {e.ts.slice(11, 19)}
                  </div>
                  <div className="col-span-3 font-mono text-fg-secondary">{e.type}</div>
                  <div className="col-span-3 text-fg">{e.actor}</div>
                  <div className="col-span-3 text-fg-secondary truncate">{e.target}</div>
                  <div className="col-span-1 text-right">
                    <StatusPill tone={tone[e.outcome]} dot>
                      {e.outcome}
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
