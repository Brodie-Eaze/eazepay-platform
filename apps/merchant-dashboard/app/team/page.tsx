'use client';
import {
  PageHeader,
  PageBody,
  Card,
  DataTable,
  Button,
  StatusPill,
  type Column,
  UsersIcon,
} from '@eazepay/ui/web';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'sales' | 'finance' | 'support';
  status: 'active' | 'invited' | 'disabled';
  lastActive: string;
}

const members: TeamMember[] = [
  {
    id: 'u_1',
    name: 'Alex Wu',
    email: 'alex@pacificsolar.com',
    role: 'owner',
    status: 'active',
    lastActive: '2026-05-04T18:55Z',
  },
  {
    id: 'u_2',
    name: 'Jordan Pak',
    email: 'jordan@pacificsolar.com',
    role: 'admin',
    status: 'active',
    lastActive: '2026-05-04T18:21Z',
  },
  {
    id: 'u_3',
    name: 'Riley Diaz',
    email: 'riley@pacificsolar.com',
    role: 'sales',
    status: 'active',
    lastActive: '2026-05-04T16:42Z',
  },
  {
    id: 'u_4',
    name: 'Sam Liu',
    email: 'sam@pacificsolar.com',
    role: 'sales',
    status: 'active',
    lastActive: '2026-05-04T14:30Z',
  },
  {
    id: 'u_5',
    name: 'Casey Brown',
    email: 'casey@pacificsolar.com',
    role: 'finance',
    status: 'invited',
    lastActive: '—',
  },
];

const columns: Column<TeamMember>[] = [
  {
    key: 'who',
    header: 'Member',
    cell: (m) => (
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-bg-muted flex items-center justify-center text-[11px] font-semibold text-fg-secondary">
          {m.name
            .split(' ')
            .map((s) => s[0])
            .join('')}
        </div>
        <div>
          <div className="font-medium">{m.name}</div>
          <div className="text-[12px] text-fg-muted">{m.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    cell: (m) => <StatusPill tone={m.role === 'owner' ? 'accent' : 'neutral'}>{m.role}</StatusPill>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (m) =>
      m.status === 'active' ? (
        <StatusPill tone="success" dot>
          Active
        </StatusPill>
      ) : m.status === 'invited' ? (
        <StatusPill tone="info">Invited</StatusPill>
      ) : (
        <StatusPill tone="neutral">Disabled</StatusPill>
      ),
  },
  {
    key: 'last',
    header: 'Last active',
    align: 'right',
    cell: (m) => (
      <span className="text-[12px] text-fg-muted tabular-nums">
        {m.lastActive === '—' ? '—' : new Date(m.lastActive).toLocaleString('en-US')}
      </span>
    ),
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: () => (
      <Button size="sm" variant="ghost">
        Manage
      </Button>
    ),
  },
];

export default function TeamPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Team' }]}
        title="Team"
        description="Members and their access. Roles are scoped — sales can only see their own applications, finance sees settlements but not customer PII."
        actions={<Button leadingIcon={<UsersIcon size={16} />}>Invite member</Button>}
      />
      <PageBody>
        <DataTable columns={columns} rows={members} rowKey={(m) => m.id} />
      </PageBody>
    </>
  );
}
