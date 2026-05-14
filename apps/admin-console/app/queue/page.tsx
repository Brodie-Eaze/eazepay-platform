'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  DataTable,
  Button,
  StatusPill,
  Input,
  Select,
  Money,
  Apr,
  Tabs,
  AlertIcon,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';
import { queueApplications, type QueueApplication } from '../../lib/mock-data';

const statusTone = (s: QueueApplication['status']) => {
  if (s === 'funded' || s === 'approved') return <StatusPill tone="success">{label(s)}</StatusPill>;
  if (s === 'declined') return <StatusPill tone="danger">Declined</StatusPill>;
  if (s === 'manual_review') return <StatusPill tone="warning">Manual review</StatusPill>;
  if (s === 'docs_required') return <StatusPill tone="warning">Docs required</StatusPill>;
  if (s === 'offers_presented') return <StatusPill tone="info">Offers presented</StatusPill>;
  return <StatusPill tone="neutral" dot>{label(s)}</StatusPill>;
};
const label = (s: string) => s.replace('_', ' ').replace(/^./, (c) => c.toUpperCase());

const tabs = [
  { key: 'all', label: 'All', count: queueApplications.length },
  { key: 'manual_review', label: 'Manual review', count: queueApplications.filter((a) => a.status === 'manual_review').length },
  { key: 'docs_required', label: 'Docs required', count: queueApplications.filter((a) => a.status === 'docs_required').length },
  { key: 'offers_presented', label: 'Offers presented', count: queueApplications.filter((a) => a.status === 'offers_presented').length },
  { key: 'holds', label: 'Compliance holds', count: queueApplications.filter((a) => a.hold).length },
];

export default function QueuePage() {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState('');

  const filtered = queueApplications.filter((a) => {
    if (tab === 'manual_review' && a.status !== 'manual_review') return false;
    if (tab === 'docs_required' && a.status !== 'docs_required') return false;
    if (tab === 'offers_presented' && a.status !== 'offers_presented') return false;
    if (tab === 'holds' && !a.hold) return false;
    if (assignee && (a.assignedTo ?? 'unassigned') !== assignee) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!a.id.toLowerCase().includes(q) && !a.applicantInitials.toLowerCase().includes(q) && !(a.merchantName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const columns: Column<QueueApplication>[] = [
    {
      key: 'app',
      header: 'Application',
      width: '22%',
      cell: (a) => (
        <Link href={`/queue/${a.id}`} className="text-fg hover:text-accent">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-bg-muted flex items-center justify-center text-[11px] font-semibold text-fg-secondary">{a.applicantInitials}</div>
            <div>
              <div className="font-mono text-[12px] text-fg-muted">{a.id}</div>
              <div className="text-[13px]">{a.category.replace('_', ' ')} · {a.termMonths}mo</div>
            </div>
          </div>
        </Link>
      ),
    },
    { key: 'channel', header: 'Channel', cell: (a) => (
      <div>
        <div className="text-[13px]">{a.channel === 'merchant' ? a.merchantName : 'Direct'}</div>
        <div className="text-[12px] text-fg-muted">{a.state}</div>
      </div>
    )},
    { key: 'amount', header: 'Requested', align: 'right', cell: (a) => <Money cents={a.requestedCents} noFractions /> },
    { key: 'risk', header: 'Risk', align: 'right', cell: (a) => (
      <span className={a.riskScore > 250 ? 'text-warning' : a.riskScore > 150 ? 'text-fg-secondary' : 'text-success'}>
        {a.riskScore}
      </span>
    )},
    { key: 'lenders', header: 'Routed', align: 'right', cell: (a) => `${a.routedLenderCount}` },
    { key: 'best', header: 'Best APR', align: 'right', cell: (a) => a.bestOfferAprBps ? <Apr bps={a.bestOfferAprBps} /> : <span className="text-fg-muted">—</span> },
    { key: 'assignee', header: 'Assignee', cell: (a) => a.assignedTo ?? <span className="text-fg-muted">Auto-routed</span> },
    { key: 'status', header: 'Status', cell: (a) => (
      <div className="flex items-center gap-1.5">
        {statusTone(a.status)}
        {a.hold && <StatusPill tone="danger" icon={<AlertIcon size={11} />}>{a.hold.toUpperCase()}</StatusPill>}
      </div>
    )},
    { key: 'age', header: 'Age', align: 'right', cell: (a) => <span className="text-[12px] tabular-nums text-fg-muted">{a.ageHours < 1 ? `${Math.round(a.ageHours * 60)}m` : `${a.ageHours.toFixed(1)}h`}</span> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Application queue' }]}
        title="Application queue"
        description="Every application across all channels. Sorted by age × risk × revenue impact. Click any row to open the underwriting workspace."
        actions={
          <>
            <Button variant="ghost">Bulk reassign</Button>
            <Button>Export queue snapshot</Button>
          </>
        }
      />
      <PageBody>
        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <Input
              leadingIcon={<SearchIcon size={14} />}
              placeholder="Search by ID, applicant, merchant…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:col-span-2"
            />
            <Select
              label=""
              value={assignee}
              onChange={(e: any) => setAssignee(e.target.value)}
              options={[
                { value: '', label: 'All assignees' },
                { value: 'Priya V.', label: 'Priya V.' },
                { value: 'Devon L.', label: 'Devon L.' },
                { value: 'unassigned', label: 'Auto-routed' },
              ]}
            />
            <Select
              label=""
              defaultValue=""
              options={[
                { value: '', label: 'All states' },
                ...['TX', 'CA', 'FL', 'GA', 'NC', 'WA', 'IL', 'AZ', 'NY'].map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
        </Card>

        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />

        <DataTable columns={columns} rows={filtered} rowKey={(a) => a.id} empty="No applications match." />
      </PageBody>
    </>
  );
}
