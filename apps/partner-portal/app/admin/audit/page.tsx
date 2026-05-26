'use client';

/**
 * /admin/audit — Platform-wide audit log viewer.
 *
 * Distinct from the per-application event log (which lives on the
 * application detail page). This is the admin-action log: lender
 * toggles, vertical-config publishes, partner suspensions, MID
 * status changes, provisioning runs.
 *
 * Source: `audit_log` table when DATABASE_URL is set, synthetic
 * fixture otherwise.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  Skeleton,
  EmptyState,
  type StatusTone,
} from '@eazepay/ui/web';

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  payloadJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Map known action verbs to a StatusPill tone. Unknown actions fall
 *  back to `neutral`. We render the pill rather than colour the raw
 *  text so the action reads as a categorised tag, not just coloured
 *  prose. */
function actionTone(action: string): StatusTone {
  switch (action) {
    case 'lender.toggle':
      return 'info';
    case 'vertical_config.publish':
    case 'partner.reactivate':
    case 'provision.complete':
    case 'migration.complete':
      return 'success';
    case 'partner.suspend':
    case 'provision.failed':
      return 'danger';
    case 'mid.status_change':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function AuditLogPage(): JSX.Element {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [source, setSource] = useState<'db' | 'synthetic'>('synthetic');
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterActor) params.set('actor', filterActor);
    if (filterAction) params.set('action', filterAction);
    if (filterTargetType) params.set('targetType', filterTargetType);
    const url = `/api/admin/audit${params.toString() ? `?${params}` : ''}`;
    setLoading(true);
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { source: 'db' | 'synthetic'; entries: AuditEntry[] }) => {
        setSource(d.source);
        setEntries(d.entries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterActor, filterAction, filterTargetType]);

  const uniqueActors = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actor))).sort(),
    [entries],
  );
  const uniqueActions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
  );
  const uniqueTargetTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.targetType))).sort(),
    [entries],
  );

  const hasFilter = Boolean(filterActor || filterAction || filterTargetType);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }]}
        title="Platform actions"
        description="Every admin action across the platform — search by actor, action, or target type."
        meta={
          <StatusPill tone={source === 'db' ? 'success' : 'neutral'} dot>
            source: {source}
          </StatusPill>
        }
      />
      <PageBody>
        <div
          className="flex flex-wrap items-end gap-2 mb-4"
          role="search"
          aria-label="Filter audit entries"
        >
          <FilterSelect
            id="filter-actor"
            label="Actor"
            value={filterActor}
            onChange={setFilterActor}
            options={uniqueActors}
          />
          <FilterSelect
            id="filter-action"
            label="Action"
            value={filterAction}
            onChange={setFilterAction}
            options={uniqueActions}
          />
          <FilterSelect
            id="filter-target"
            label="Target type"
            value={filterTargetType}
            onChange={setFilterTargetType}
            options={uniqueTargetTypes}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterActor('');
              setFilterAction('');
              setFilterTargetType('');
            }}
            disabled={!hasFilter}
          >
            Clear
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardBody>
              <Skeleton rows={6} label="Loading audit entries" />
            </CardBody>
          </Card>
        ) : entries.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description={
              hasFilter
                ? 'No entries match these filters. Clear filters to see all activity.'
                : 'No admin actions have been recorded yet.'
            }
          />
        ) : (
          <Card>
            <CardBody padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg-muted/40 text-left text-fg-muted">
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        When
                      </th>
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        Actor
                      </th>
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        Action
                      </th>
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        Target
                      </th>
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        Payload
                      </th>
                      <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em]">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 text-fg-secondary whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <strong className="text-fg">{e.actor}</strong>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={actionTone(e.action)}>{e.action}</StatusPill>
                        </td>
                        <td className="px-4 py-3 text-fg-secondary">
                          {e.targetType}
                          {e.targetId && <span className="text-fg-muted"> · {e.targetId}</span>}
                        </td>
                        <td className="px-4 py-3 max-w-[340px]">
                          {e.payloadJson ? (
                            <code className="text-[11px] text-accent break-all">
                              {e.payloadJson}
                            </code>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-fg-muted text-[12px] whitespace-nowrap">
                          {e.ipAddress ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}): JSX.Element {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] flex-1 min-w-[160px]">
      <span className="font-medium text-fg-secondary text-[12px]">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
