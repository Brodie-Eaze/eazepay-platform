'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Filter,
  StatusPill,
  DataTable,
  Avatar,
  AvatarFallback,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Banner,
  type Column,
  UsersIcon,
  ShieldIcon,
  CheckIcon,
  AlertIcon,
  SettingsIcon,
} from '@eazepay/ui/web';

type MemberRole = 'master_admin' | 'admin' | 'underwriter' | 'compliance' | 'support' | 'read_only';
type MemberStatus = 'active' | 'invited' | 'disabled';

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  lastSignInAt: string | null;
  invitedBy: string | null;
  invitedAt: string;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  master_admin: 'Master admin',
  admin: 'Admin',
  underwriter: 'Underwriter',
  compliance: 'Compliance',
  support: 'Support',
  read_only: 'Read-only',
};

const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  master_admin: 'Everything, including managing this team and rotating credentials.',
  admin: 'Operate the platform, approve merchants, manage partners — cannot rotate the master KEK.',
  underwriter: 'Review applications, approve up to $50k, escalate above that.',
  compliance:
    'Read-only on financials; full access to audit + SAR queues + JIT PII unmask requests.',
  support: 'Scoped to the active ticket; PII purpose-bound.',
  read_only: 'Audit-log only; cannot mutate any state.',
};

const SEED_MEMBERS: TeamMember[] = [
  {
    id: 'u_brodie',
    displayName: 'Brodie Eaze',
    email: 'brodie@eaze.test',
    role: 'master_admin',
    status: 'active',
    lastSignInAt: '2026-05-04T18:42Z',
    invitedBy: null,
    invitedAt: '2025-12-04T09:00Z',
  },
  {
    id: 'u_priya',
    displayName: 'Priya Vasquez',
    email: 'priya@eaze.test',
    role: 'underwriter',
    status: 'active',
    lastSignInAt: '2026-05-04T17:18Z',
    invitedBy: 'u_brodie',
    invitedAt: '2026-01-12T11:30Z',
  },
  {
    id: 'u_devon',
    displayName: 'Devon Lin',
    email: 'devon@eaze.test',
    role: 'compliance',
    status: 'active',
    lastSignInAt: '2026-05-04T15:11Z',
    invitedBy: 'u_brodie',
    invitedAt: '2026-01-18T10:14Z',
  },
  {
    id: 'u_kai',
    displayName: 'Kai Nakamura',
    email: 'kai@eaze.test',
    role: 'admin',
    status: 'active',
    lastSignInAt: '2026-05-03T22:08Z',
    invitedBy: 'u_brodie',
    invitedAt: '2026-02-02T09:00Z',
  },
  {
    id: 'u_sloane',
    displayName: 'Sloane Whitaker',
    email: 'sloane@eaze.test',
    role: 'support',
    status: 'active',
    lastSignInAt: '2026-05-04T11:02Z',
    invitedBy: 'u_kai',
    invitedAt: '2026-02-19T14:48Z',
  },
  {
    id: 'u_evan',
    displayName: 'Evan Mireles',
    email: 'evan@eaze.test',
    role: 'support',
    status: 'invited',
    lastSignInAt: null,
    invitedBy: 'u_kai',
    invitedAt: '2026-05-02T16:30Z',
  },
  {
    id: 'u_marcus',
    displayName: 'Marcus Bell',
    email: 'marcus@eaze.test',
    role: 'read_only',
    status: 'disabled',
    lastSignInAt: '2026-04-08T09:10Z',
    invitedBy: 'u_brodie',
    invitedAt: '2025-12-22T13:11Z',
  },
];

const fmtSignIn = (iso: string | null) =>
  !iso
    ? 'Never'
    : new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const lookupById = (id: string | null, members: TeamMember[]) =>
  id ? (members.find((m) => m.id === id)?.displayName ?? 'Unknown') : '—';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(SEED_MEMBERS);
  /* `null` represents "All" per canonical <Filter>. */
  const [filter, setFilter] = useState<MemberStatus | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Best-effort load from the BFF; fall through to seed data so the
  // page is useful in dev / when the API isn't reachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/team', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { members: TeamMember[] };
        if (!cancelled && Array.isArray(data.members) && data.members.length > 0) {
          setMembers(data.members);
        }
      } catch {
        /* keep seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMembers = filter === null ? members : members.filter((m) => m.status === filter);

  const updateMember = useCallback((id: string, patch: Partial<TeamMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    // Fire-and-forget BFF sync; UI is optimistic.
    void fetch(`/api/admin/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      credentials: 'include',
    }).catch(() => undefined);
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    void fetch(`/api/admin/team/${id}`, { method: 'DELETE', credentials: 'include' }).catch(
      () => undefined,
    );
    setConfirmRemoveId(null);
  }, []);

  const addMember = useCallback(
    async (input: { displayName: string; email: string; role: MemberRole }) => {
      const optimistic: TeamMember = {
        id: `u_${Date.now().toString(36)}`,
        displayName: input.displayName || input.email.split('@')[0] || input.email,
        email: input.email,
        role: input.role,
        status: 'invited',
        lastSignInAt: null,
        invitedBy: 'u_brodie',
        invitedAt: new Date().toISOString(),
      };
      setMembers((prev) => [optimistic, ...prev]);
      setInviteOpen(false);
      try {
        const res = await fetch('/api/admin/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { member: TeamMember };
          if (data?.member) {
            setMembers((prev) => prev.map((m) => (m.id === optimistic.id ? data.member : m)));
          }
        }
      } catch {
        /* keep optimistic */
      }
    },
    [],
  );

  const columns: Column<TeamMember>[] = [
    {
      key: 'who',
      header: 'Member',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar size={32}>
            <AvatarFallback>
              {m.displayName
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{m.displayName}</div>
            <div className="text-[12px] text-fg-muted">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => (
        <div>
          <div className="text-[13px] font-medium">{ROLE_LABEL[m.role]}</div>
          <div className="text-[11px] text-fg-muted line-clamp-1 max-w-[260px]">
            {ROLE_DESCRIPTION[m.role]}
          </div>
        </div>
      ),
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
          <StatusPill tone="info" dot>
            Invited
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">Disabled</StatusPill>
        ),
    },
    {
      key: 'last',
      header: 'Last sign-in',
      align: 'right',
      cell: (m) => (
        <span className="text-[12px] text-fg-muted tabular-nums">{fmtSignIn(m.lastSignInAt)}</span>
      ),
    },
    {
      key: 'invited',
      header: 'Invited by',
      cell: (m) => (
        <span className="text-[12px] text-fg-muted">{lookupById(m.invitedBy, members)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <RowActions member={m} onUpdate={updateMember} onRemove={() => setConfirmRemoveId(m.id)} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }, { label: 'Internal team' }]}
        title="Internal team"
        description="People with access to the EazePay command centre. Invite, change roles, disable — every change is written to the audit chain."
        meta={
          <>
            <StatusPill tone="success" dot>
              {members.filter((m) => m.status === 'active').length} active
            </StatusPill>
            <StatusPill tone="info">
              {members.filter((m) => m.status === 'invited').length} pending invites
            </StatusPill>
            {members.filter((m) => m.status === 'disabled').length > 0 && (
              <StatusPill tone="neutral">
                {members.filter((m) => m.status === 'disabled').length} disabled
              </StatusPill>
            )}
          </>
        }
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button leadingIcon={<UsersIcon size={14} />}>Invite member</Button>
            </DialogTrigger>
            <InviteDialog onSubmit={addMember} />
          </Dialog>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          Hardware-key MFA is required for <strong>Master admin</strong> and <strong>Admin</strong>{' '}
          roles. PII reads stay JIT-gated regardless of role. Removing someone instantly revokes
          their refresh tokens.
        </Banner>

        <Card padded className="mb-4">
          <Filter<MemberStatus>
            label="Member status"
            value={filter}
            onChange={setFilter}
            allLabel={`All (${members.length})`}
            options={[
              {
                value: 'active',
                label: 'Active',
                count: members.filter((m) => m.status === 'active').length,
              },
              {
                value: 'invited',
                label: 'Invited',
                count: members.filter((m) => m.status === 'invited').length,
              },
              {
                value: 'disabled',
                label: 'Disabled',
                count: members.filter((m) => m.status === 'disabled').length,
              },
            ]}
          />
        </Card>

        <Card>
          <DataTable columns={columns} rows={visibleMembers} rowKey={(m) => m.id} dense />
        </Card>

        {/* Remove confirmation */}
        <Dialog
          open={confirmRemoveId !== null}
          onOpenChange={(v) => !v && setConfirmRemoveId(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove team member?</DialogTitle>
              <DialogDescription>
                {confirmRemoveId
                  ? `Removes ${members.find((m) => m.id === confirmRemoveId)?.displayName ?? 'this member'} from the
                  internal team, revokes refresh tokens, and writes a removal event to the audit chain. Their
                  past actions remain in the log.`
                  : null}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={() => confirmRemoveId && removeMember(confirmRemoveId)}
                leadingIcon={<AlertIcon size={14} />}
              >
                Remove member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </>
  );
}

/* ---------- row actions ---------- */

function RowActions({
  member,
  onUpdate,
  onRemove,
}: {
  member: TeamMember;
  onUpdate: (id: string, patch: Partial<TeamMember>) => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          ···
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{member.displayName}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'master_admin' })}>
          <ShieldIcon size={14} /> Make master admin
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'admin' })}>
          <ShieldIcon size={14} /> Make admin
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'underwriter' })}>
          <SettingsIcon size={14} /> Make underwriter
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'compliance' })}>
          <SettingsIcon size={14} /> Make compliance
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'support' })}>
          <SettingsIcon size={14} /> Make support
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { role: 'read_only' })}>
          <SettingsIcon size={14} /> Make read-only
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {member.status === 'disabled' ? (
          <DropdownMenuItem onSelect={() => onUpdate(member.id, { status: 'active' })}>
            <CheckIcon size={14} /> Re-enable account
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onUpdate(member.id, { status: 'disabled' })}>
            <AlertIcon size={14} /> Disable account
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onUpdate(member.id, { status: 'invited' })}>
          <AlertIcon size={14} /> Force password reset
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={onRemove}>
          <AlertIcon size={14} /> Remove from team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- invite dialog ---------- */

function InviteDialog({
  onSubmit,
}: {
  onSubmit: (input: { displayName: string; email: string; role: MemberRole }) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('underwriter');

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invite an internal team member</DialogTitle>
        <DialogDescription>
          They'll receive an email with a one-time link to set their password and enrol in MFA.
          Until they accept, the row shows as <strong>Invited</strong>.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 py-2">
        <Input
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alex@eaze.test"
          required
          autoFocus
        />
        <Input
          label="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Alex Wu"
        />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          options={[
            { value: 'master_admin', label: 'Master admin' },
            { value: 'admin', label: 'Admin' },
            { value: 'underwriter', label: 'Underwriter' },
            { value: 'compliance', label: 'Compliance' },
            { value: 'support', label: 'Support' },
            { value: 'read_only', label: 'Read-only' },
          ]}
          hint={ROLE_DESCRIPTION[role]}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button
          disabled={!email || !email.includes('@')}
          onClick={() => onSubmit({ displayName, email, role })}
        >
          Send invite
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
