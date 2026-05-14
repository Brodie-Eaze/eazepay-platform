'use client';
import {
  PageHeader,
  PageBody,
  Card,
  Banner,
  DataTable,
  Input,
  Select,
  Button,
  StatusPill,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';
import { auditLogs, fmtDate } from '../../lib/mock-data';
import { useState } from 'react';

type Log = (typeof auditLogs)[number];

export default function AuditPage() {
  const [query, setQuery] = useState('');

  const filtered = auditLogs.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      l.actor.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.target.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  const columns: Column<Log>[] = [
    { key: 'id', header: 'Event', cell: (l) => <span className="font-mono text-[12px]">{l.id}</span> },
    { key: 'at', header: 'When', cell: (l) => <span className="text-[12px] text-fg-muted tabular-nums">{fmtDate(l.at)}</span> },
    { key: 'actor', header: 'Actor', cell: (l) => l.actor.includes('@') ? <span>{l.actor}</span> : <StatusPill tone="neutral">{l.actor}</StatusPill> },
    { key: 'action', header: 'Action', cell: (l) => <span className="font-mono text-[12px]">{l.action}</span> },
    { key: 'target', header: 'Target', cell: (l) => <span className="text-[12px] text-fg-secondary">{l.target}</span> },
    { key: 'hash', header: 'Hash', align: 'right', cell: () => <span className="font-mono text-[11px] text-fg-muted">sha256:f4e9…</span> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Audit log' }]}
        title="Audit log"
        description="Hash-chained append-only log of every action. PII reads, decisions, configuration changes, webhook deliveries — all recorded."
        actions={<Button>Export window</Button>}
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          Each event is linked to the previous via <span className="font-mono text-[12px]">prev_hash</span>{' '}
          and persisted in DynamoDB + S3 Object Lock (7-year retention).{' '}
          <strong>Tampering is detectable</strong> in a single pass.
        </Banner>

        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <Input
              leadingIcon={<SearchIcon size={14} />}
              placeholder="Search by actor, action, target…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:col-span-2"
            />
            <Select label="" defaultValue="" options={[
              { value: '', label: 'All actions' },
              { value: 'application', label: 'application.*' },
              { value: 'pii', label: 'pii.*' },
              { value: 'consent', label: 'consent.*' },
              { value: 'lender', label: 'lender.*' },
              { value: 'admin', label: 'admin.*' },
            ]} />
            <Select label="" defaultValue="" options={[
              { value: '', label: 'Last 24 hours' },
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ]} />
          </div>
        </Card>

        <DataTable columns={columns} rows={filtered} rowKey={(l) => l.id} dense />
      </PageBody>
    </>
  );
}
