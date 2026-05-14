'use client';
import { useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusPill,
  Banner,
  UsersIcon,
  ShieldIcon,
  KeyIcon,
  CheckIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

/**
 * Per-brand team & roles management.
 *
 * Each member's permissions are scoped to the active brand — a MedPay
 * "Operator" can approve MedPay applications but not see TradePay
 * data even if the parent organisation runs both verticals. RBAC is
 * enforced server-side on every BFF call against the partner-scoped
 * JWT, so flipping a role here re-shapes what that user can see on
 * their next session refresh.
 */

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Operator' | 'Viewer' | 'Compliance';
  status: 'active' | 'invited' | 'suspended';
  lastSeen: string;
  mfa: boolean;
}

const SEED: TeamMember[] = [
  {
    id: 'u_01',
    name: 'Brodie Tatum',
    email: 'brodie@amalafinance.com.au',
    role: 'Owner',
    status: 'active',
    lastSeen: '2 min ago',
    mfa: true,
  },
  {
    id: 'u_02',
    name: 'Lena Park',
    email: 'lena@amalafinance.com.au',
    role: 'Admin',
    status: 'active',
    lastSeen: '14 min ago',
    mfa: true,
  },
  {
    id: 'u_03',
    name: 'Cole Ramirez',
    email: 'cole@amalafinance.com.au',
    role: 'Operator',
    status: 'active',
    lastSeen: '1h ago',
    mfa: true,
  },
  {
    id: 'u_04',
    name: 'Devin Cho',
    email: 'devin@amalafinance.com.au',
    role: 'Operator',
    status: 'active',
    lastSeen: '3h ago',
    mfa: false,
  },
  {
    id: 'u_05',
    name: 'Maya Patel',
    email: 'maya@amalafinance.com.au',
    role: 'Compliance',
    status: 'active',
    lastSeen: 'Today',
    mfa: true,
  },
  {
    id: 'u_06',
    name: 'Tarun Singh',
    email: 'tarun@amalafinance.com.au',
    role: 'Viewer',
    status: 'invited',
    lastSeen: '—',
    mfa: false,
  },
];

const ROLE_DESCRIPTIONS: Record<TeamMember['role'], { tone: 'accent' | 'success' | 'warning' | 'info' | 'neutral'; desc: string }> = {
  Owner: { tone: 'accent', desc: 'Full control · billing · contracts · cannot be removed' },
  Admin: { tone: 'success', desc: 'Approve · invite · configure integrations · audit log' },
  Operator: { tone: 'info', desc: 'Approve applications · view PII · resolve exceptions' },
  Viewer: { tone: 'neutral', desc: 'Read-only · masked PII · no write actions' },
  Compliance: { tone: 'warning', desc: 'Audit log access · adverse action review · cannot mutate financial state' },
};

export default function BrandTeamPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const spec = BRANDS[brand!];

  const [team, setTeam] = useState<TeamMember[]>(SEED);
  const [inviteOpen, setInviteOpen] = useState(false);

  const counts = team.reduce(
    (acc, m) => {
      acc.total += 1;
      if (m.status === 'active') acc.active += 1;
      if (m.mfa) acc.mfa += 1;
      return acc;
    },
    { total: 0, active: 0, mfa: 0 },
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: spec.name, href: `/v/${brandSlug}` }, { label: 'Team & roles' }]}
        title={`${spec.name} team`}
        description={`Members and roles scoped to your ${spec.name} portal only. Cross-brand access requires an Owner-level approval.`}
        actions={
          <Button size="sm" onClick={() => setInviteOpen((v) => !v)}>
            {inviteOpen ? 'Cancel' : 'Invite member'}
          </Button>
        }
        meta={
          <>
            <StatusPill tone="success" dot>
              {counts.active}/{counts.total} active
            </StatusPill>
            <StatusPill tone={counts.mfa === counts.total ? 'success' : 'warning'}>
              MFA: {counts.mfa}/{counts.total}
            </StatusPill>
          </>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-5">
          <strong>{spec.name} portal scope.</strong> These permissions only apply inside the{' '}
          {spec.name} portal — your team's TradePay or CoachPay portal access is managed
          separately under each brand's Team page.
        </Banner>

        {inviteOpen && (
          <Card className="mb-5">
            <CardBody>
              <h2 className="text-[14px] font-semibold mb-3">Invite a teammate to {spec.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="email"
                  placeholder="teammate@yourpractice.com"
                  className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                />
                <select className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]">
                  <option>Operator (default)</option>
                  <option>Admin</option>
                  <option>Viewer</option>
                  <option>Compliance</option>
                </select>
                <Button size="sm" onClick={() => setInviteOpen(false)}>
                  Send invitation
                </Button>
              </div>
              <p className="text-[11px] text-fg-muted mt-2">
                Invites expire in 72 hours and require MFA enrolment on first login.
              </p>
            </CardBody>
          </Card>
        )}

        <Card className="mb-5">
          <CardHeader title="Members" description={`${counts.active} active · ${counts.total - counts.active} invited / suspended`} />
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted border-b border-border">
              <span className="col-span-4">Member</span>
              <span className="col-span-2">Role</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2">MFA</span>
              <span className="col-span-2 text-right">Last seen</span>
            </div>
            <ul className="divide-y divide-border">
              {team.map((m) => (
                <li key={m.id} className="grid grid-cols-12 items-center px-5 py-3 text-[13px]">
                  <div className="col-span-4 min-w-0 flex items-center gap-2.5">
                    <span className="size-7 rounded-full bg-bg-muted text-fg-secondary text-[11px] font-semibold flex items-center justify-center">
                      {m.name
                        .split(' ')
                        .map((s) => s[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-fg truncate">{m.name}</p>
                      <p className="text-[11px] text-fg-muted truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setTeam((prev) =>
                          prev.map((u) =>
                            u.id === m.id ? { ...u, role: e.target.value as TeamMember['role'] } : u,
                          ),
                        )
                      }
                      className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-[12px]"
                      disabled={m.role === 'Owner'}
                    >
                      {(['Owner', 'Admin', 'Operator', 'Viewer', 'Compliance'] as const).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <StatusPill tone={m.status === 'active' ? 'success' : m.status === 'invited' ? 'info' : 'warning'} dot>
                      {m.status}
                    </StatusPill>
                  </div>
                  <div className="col-span-2">
                    {m.mfa ? (
                      <span className="text-[11px] inline-flex items-center gap-1 text-fg">
                        <CheckIcon size={11} /> Enabled
                      </span>
                    ) : (
                      <span className="text-[11px] text-fg-muted">Enrolment required</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-[12px] text-fg-muted">{m.lastSeen}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Role permissions"
            description={`What each role can do inside the ${spec.name} portal.`}
          />
          <CardBody>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(ROLE_DESCRIPTIONS) as TeamMember['role'][]).map((r) => {
                const d = ROLE_DESCRIPTIONS[r];
                return (
                  <li key={r} className="rounded-md border border-border bg-bg-elevated p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[13px] text-fg flex items-center gap-1.5">
                        {r === 'Owner' || r === 'Admin' ? (
                          <KeyIcon size={13} />
                        ) : r === 'Compliance' ? (
                          <ShieldIcon size={13} />
                        ) : (
                          <UsersIcon size={13} />
                        )}
                        {r}
                      </span>
                      <StatusPill tone={d.tone}>{r === 'Owner' ? 'Cannot delete' : 'Configurable'}</StatusPill>
                    </div>
                    <p className="text-[12px] text-fg-muted leading-snug">{d.desc}</p>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
