'use client';
import { useEffect, useState } from 'react';
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
import { csrfHeaders } from '../../../../lib/client-csrf';

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

const ROLE_DESCRIPTIONS: Record<
  TeamMember['role'],
  { tone: 'accent' | 'success' | 'warning' | 'info' | 'neutral'; desc: string }
> = {
  Owner: { tone: 'accent', desc: 'Full control · billing · contracts · cannot be removed' },
  Admin: { tone: 'success', desc: 'Approve · invite · configure integrations · audit log' },
  Operator: { tone: 'info', desc: 'Approve applications · view PII · resolve exceptions' },
  Viewer: { tone: 'neutral', desc: 'Read-only · masked PII · no write actions' },
  Compliance: {
    tone: 'warning',
    desc: 'Audit log access · adverse action review · cannot mutate financial state',
  },
};

interface PendingInvite {
  token: string;
  recipientEmail: string;
  role: TeamMember['role'];
  expiresAt: string;
  status: 'active' | 'accepted' | 'expired' | 'revoked';
}

export default function BrandTeamPage() {
  // All hooks declared FIRST — react-hooks/rules-of-hooks requires
  // every render to call the same hooks in the same order. The brand
  // resolution + notFound() check happens AFTER all hooks so an
  // unknown slug still passes the hook-order rule (notFound() throws
  // inside the render which unmounts; that's fine).
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const [team, setTeam] = useState<TeamMember[]>(SEED);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Invite-form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('Operator');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Load the partner's existing invites from the BFF.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v/${brandSlug}/team/invite`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { invites: PendingInvite[] };
        if (!cancelled) setPendingInvites(body.invites ?? []);
      } catch {
        /* swallow — list stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandSlug]);

  // Brand resolution after all hooks (rules-of-hooks).
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const spec = BRANDS[brand!];

  // Use the signed-in Owner's email/name as the inviter. In real
  // auth this comes from /api/auth/session; today it's the team
  // page's hard-coded Owner row.
  const inviter = team.find((m) => m.role === 'Owner') ?? team[0];

  const submitInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    setInviteSubmitting(true);
    try {
      const res = await fetch(`/api/v/${brandSlug}/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          inviterEmail: inviter?.email ?? '',
          inviterName: inviter?.name ?? 'EazePay Admin',
          ...(inviteNote.trim() ? { inviterNote: inviteNote.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          detail?: string;
          code?: string;
        };
        setInviteError(body.detail ?? body.code ?? `HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as PendingInvite;
      setPendingInvites((prev) => [body, ...prev]);
      setInviteSuccess(`Invite sent to ${body.recipientEmail}.`);
      setInviteEmail('');
      setInviteNote('');
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviteSubmitting(false);
    }
  };

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
          {spec.name} portal — your team's TradePay or CoachPay portal access is managed separately
          under each brand's Team page.
        </Banner>

        {inviteOpen && (
          <Card className="mb-5">
            <CardBody>
              <h2 className="text-[14px] font-semibold mb-3">Invite a teammate to {spec.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="email"
                  placeholder="teammate@yourpractice.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteSubmitting}
                  className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamMember['role'])}
                  disabled={inviteSubmitting}
                  className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
                >
                  <option value="Operator">Operator (default)</option>
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                  <option value="Compliance">Compliance</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => void submitInvite()}
                  disabled={inviteSubmitting || !inviteEmail.trim()}
                >
                  {inviteSubmitting ? 'Sending…' : 'Send invitation'}
                </Button>
              </div>
              <textarea
                placeholder="Optional note for the invite email (e.g. 'See you Monday')"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                disabled={inviteSubmitting}
                rows={2}
                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[12px] mb-2"
              />
              <p className="text-[11px] text-fg-muted">
                Invites expire in 7 days. The teammate gets a branded {spec.name} email and lands in
                the {spec.name} portal on accept.
              </p>
              {inviteError && (
                <Banner intent="danger" className="mt-3">
                  {inviteError}
                </Banner>
              )}
              {inviteSuccess && (
                <Banner intent="success" className="mt-3">
                  {inviteSuccess}
                </Banner>
              )}
            </CardBody>
          </Card>
        )}

        {pendingInvites.length > 0 && (
          <Card className="mb-5">
            <CardHeader
              title="Pending invites"
              description={`Sent from your ${spec.name} portal — recipients haven't accepted yet.`}
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-border">
                {pendingInvites.map((inv) => (
                  <li
                    key={inv.token}
                    className="grid grid-cols-12 items-center px-5 py-3 text-[13px]"
                  >
                    <span className="col-span-5 truncate">{inv.recipientEmail}</span>
                    <span className="col-span-2 text-fg-secondary">{inv.role}</span>
                    <span className="col-span-3">
                      <StatusPill
                        tone={
                          inv.status === 'accepted'
                            ? 'success'
                            : inv.status === 'expired'
                              ? 'warning'
                              : inv.status === 'revoked'
                                ? 'neutral'
                                : 'info'
                        }
                        dot
                      >
                        {inv.status}
                      </StatusPill>
                    </span>
                    <span className="col-span-2 text-right text-[11px] text-fg-muted">
                      expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card className="mb-5">
          <CardHeader
            title="Members"
            description={`${counts.active} active · ${counts.total - counts.active} invited / suspended`}
          />
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
                            u.id === m.id
                              ? { ...u, role: e.target.value as TeamMember['role'] }
                              : u,
                          ),
                        )
                      }
                      className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-[12px]"
                      disabled={m.role === 'Owner'}
                    >
                      {(['Owner', 'Admin', 'Operator', 'Viewer', 'Compliance'] as const).map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <StatusPill
                      tone={
                        m.status === 'active'
                          ? 'success'
                          : m.status === 'invited'
                            ? 'info'
                            : 'warning'
                      }
                      dot
                    >
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
                  <div className="col-span-2 text-right text-[12px] text-fg-muted">
                    {m.lastSeen}
                  </div>
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
                      <StatusPill tone={d.tone}>
                        {r === 'Owner' ? 'Cannot delete' : 'Configurable'}
                      </StatusPill>
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
