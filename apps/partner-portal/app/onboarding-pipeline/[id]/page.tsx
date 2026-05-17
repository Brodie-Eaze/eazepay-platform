'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  AlertIcon,
  ShieldIcon,
  DocIcon,
  SendIcon,
  PhoneIcon,
  CardIcon as ProcessingIcon,
  RouteIcon,
  UsersIcon,
  CopyIcon,
} from '@eazepay/ui/web';
import { BRANDS } from '@eazepay/shared-types';
import {
  ONBOARDING_BUSINESSES,
  STATUS_LABEL,
  KYB_LABEL,
  INTEGRATION_LABEL,
  checkLabel,
  integrationStateLabel,
  seedAgo,
  type CheckState,
  type OnboardingBusiness,
} from '../../../lib/onboarding-data';

/**
 * Per-business onboarding control room.
 *
 * Single page that wires every action an operator needs while a
 * business is moving through configuration:
 *   1. Status header with approve / decline / request-info actions
 *   2. KYB tracker (6 checks) with re-run individual control
 *   3. Integration tracker (Highsale / MyCAMP / EZ Check / Processing
 *      / DialerPay) showing where they are stuck
 *   4. Document request panel — request + receive + approve
 *   5. Comms composer — push / email / SMS to the business
 *   6. Communication + activity timelines (mirror Lovable's "Activity"
 *      feed for full audit lineage)
 *   7. Internal notes
 *   8. Throttle controls (rate limits, manual review toggle)
 */

const ago = seedAgo;

const OPERATOR_EMAIL = 'brodie@amalafinance.com.au';

const checkTone = (s: CheckState): 'success' | 'warning' | 'neutral' | 'info' =>
  s === 'pass'
    ? 'success'
    : s === 'fail'
      ? 'warning'
      : s === 'running'
        ? 'info'
        : s === 'review'
          ? 'warning'
          : 'neutral';

/** Pulls the operator's invite list and checks whether the business
 * on this page was opened from one of them (by contact email match).
 * Cheap, runs once. Returns null while loading so the badge doesn't
 * flicker in. */
function useInvitedByOperator(contactEmail: string): boolean | null {
  const [invited, setInvited] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/onboarding/invite?invitedByEmail=${encodeURIComponent(OPERATOR_EMAIL)}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          if (!cancelled) setInvited(false);
          return;
        }
        const json = (await res.json()) as {
          invites: Array<{ prefill?: { contactEmail?: string } }>;
        };
        if (cancelled) return;
        const match = json.invites?.some(
          (i) =>
            i.prefill?.contactEmail &&
            i.prefill.contactEmail.toLowerCase() === contactEmail.toLowerCase(),
        );
        setInvited(!!match);
      } catch {
        if (!cancelled) setInvited(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactEmail]);
  return invited;
}

export default function OnboardingBusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const seed = useMemo(() => ONBOARDING_BUSINESSES.find((b) => b.id === id), [id]);
  if (!seed) notFound();
  const biz = seed!;
  const invitedByOperator = useInvitedByOperator(biz.primaryContact.email);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master', href: '/' },
          { label: 'Onboarding', href: '/onboarding-pipeline' },
          { label: biz.legalName },
        ]}
        title={biz.legalName}
        description={`${biz.industry} · ${biz.state} · EIN ${biz.ein}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button size="sm" variant="ghost">
              Send to compliance
            </Button>
            <Button size="sm" variant="secondary">
              Decline
            </Button>
            <Button size="sm">Approve · go live</Button>
          </div>
        }
        meta={
          <>
            <StatusPill tone="accent" dot>
              {STATUS_LABEL[biz.status]}
            </StatusPill>
            {biz.brands.map((br) => (
              <StatusPill key={br} tone="neutral">
                {BRANDS[br].name}
              </StatusPill>
            ))}
            {invitedByOperator && (
              <StatusPill tone="info" dot>
                Your invite
              </StatusPill>
            )}
            <StatusPill tone="neutral">Last activity {ago(biz.lastActivityAt)}</StatusPill>
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* ─── Left column ─── */}
          <div className="xl:col-span-2 space-y-4">
            <BusinessSnapshot biz={biz} />
            <KybTrackerCard biz={biz} />
            <IntegrationsTrackerCard biz={biz} />
            <DocumentsCard biz={biz} />
            <ActivityTimelineCard biz={biz} />
          </div>

          {/* ─── Right column ─── */}
          <div className="space-y-4">
            <CommsComposerCard biz={biz} />
            <NotesCard biz={biz} />
            <ThrottleCard />
            <DangerZoneCard />
          </div>
        </div>
      </PageBody>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function BusinessSnapshot({ biz }: { biz: OnboardingBusiness }) {
  const initials = biz.legalName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-3">
          <span className="size-12 rounded-lg bg-bg-muted text-fg-secondary font-semibold text-[14px] flex items-center justify-center shrink-0">
            {initials}
          </span>
          <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Snapshot label="Primary contact" value={biz.primaryContact.name} />
            <Snapshot label="Email" value={biz.primaryContact.email} copyable />
            <Snapshot label="Phone" value={biz.primaryContact.phone} copyable />
            <Snapshot label="Invited by" value={biz.invitedBy} />
            <Snapshot
              label="Invited"
              value={new Date(biz.invitedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            />
            <Snapshot label="EIN" value={biz.ein} />
            <Snapshot label="State" value={biz.state} />
            <Snapshot label="DBA" value={biz.dba ?? '—'} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Snapshot({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="text-[12px] text-fg font-medium mt-0.5 flex items-center gap-1.5 truncate">
        <span className="truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="text-fg-muted hover:text-fg shrink-0"
          >
            {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
          </button>
        )}
      </p>
    </div>
  );
}

function KybTrackerCard({ biz }: { biz: OnboardingBusiness }) {
  const entries = Object.entries(biz.kyb) as Array<[keyof OnboardingBusiness['kyb'], CheckState]>;
  const failing = entries.filter(([, s]) => s === 'fail' || s === 'review');
  return (
    <Card>
      <CardHeader
        title="KYB · sanctions · BOI"
        description="BSA / FinCEN-aligned pulls. Re-run any control on demand."
        action={
          <Button size="sm" variant="ghost">
            Re-run all
          </Button>
        }
      />
      <CardBody className="p-0">
        {failing.length > 0 && (
          <div className="px-5 pt-1 pb-3">
            <Banner intent="warning">
              {failing.length} {failing.length === 1 ? 'control' : 'controls'} need attention.
              Resolve before approval.
            </Banner>
          </div>
        )}
        <ul className="divide-y divide-border">
          {entries.map(([k, state]) => (
            <li key={k} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-bg-muted/40">
              <span className="col-span-5 text-[13px] font-medium text-fg">{KYB_LABEL[k]}</span>
              <span className="col-span-3">
                <StatusPill tone={checkTone(state)} dot>
                  {checkLabel(state)}
                </StatusPill>
              </span>
              <span className="col-span-2 text-[11px] text-fg-muted">
                {state === 'pass' ? 'cleared' : state === 'pending' ? '—' : 'requires review'}
              </span>
              <span className="col-span-2 text-right">
                <Button size="sm" variant="ghost">
                  {state === 'fail' || state === 'review' ? 'Resolve' : 'Re-run'}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function IntegrationsTrackerCard({ biz }: { biz: OnboardingBusiness }) {
  const entries = Object.entries(biz.integrations) as Array<
    [
      keyof OnboardingBusiness['integrations'],
      OnboardingBusiness['integrations'][keyof OnboardingBusiness['integrations']],
    ]
  >;
  const iconFor = (k: keyof OnboardingBusiness['integrations']) =>
    k === 'highsale' ? (
      <ShieldIcon size={14} />
    ) : k === 'mycamp' ? (
      <ProcessingIcon size={14} />
    ) : k === 'ezCheck' ? (
      <ShieldIcon size={14} />
    ) : k === 'processing' ? (
      <ProcessingIcon size={14} />
    ) : (
      <PhoneIcon size={14} />
    );
  return (
    <Card>
      <CardHeader
        title="Integration onboarding"
        description="Track where the business is in each provider funnel. Nudge them if they're stuck."
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-border">
          {entries.map(([k, state]) => {
            const blocked = state === 'blocked';
            const notStarted = state === 'not_started';
            return (
              <li
                key={k}
                className="grid grid-cols-12 items-center px-5 py-3 hover:bg-bg-muted/40 gap-3"
              >
                <span className="col-span-5 flex items-center gap-2 text-[13px] font-medium text-fg">
                  <span className="size-7 rounded-md bg-bg-muted text-fg-secondary flex items-center justify-center">
                    {iconFor(k)}
                  </span>
                  {INTEGRATION_LABEL[k]}
                </span>
                <span className="col-span-3">
                  <StatusPill
                    tone={
                      state === 'completed'
                        ? 'success'
                        : state === 'in_progress'
                          ? 'info'
                          : blocked
                            ? 'warning'
                            : 'neutral'
                    }
                    dot
                  >
                    {integrationStateLabel(state)}
                  </StatusPill>
                </span>
                <span className="col-span-2 text-[11px] text-fg-muted">
                  {state === 'completed'
                    ? 'live'
                    : notStarted
                      ? 'not started'
                      : state === 'blocked'
                        ? 'needs help'
                        : 'progressing'}
                </span>
                <span className="col-span-2 text-right">
                  <Button size="sm" variant="ghost">
                    {notStarted || blocked
                      ? 'Nudge'
                      : state === 'completed'
                        ? 'Verify'
                        : 'Open thread'}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function DocumentsCard({ biz }: { biz: OnboardingBusiness }) {
  const [docs, setDocs] = useState(biz.docs);
  const [newDoc, setNewDoc] = useState('');

  const requestDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.trim()) return;
    setDocs((rows) => [
      ...rows,
      {
        id: `doc_${Date.now().toString(36)}`,
        name: newDoc.trim(),
        required: true,
        status: 'requested',
        requestedAt: new Date().toISOString(),
      },
    ]);
    setNewDoc('');
  };

  return (
    <Card>
      <CardHeader
        title="Documents"
        description="Request additional documentation. The business sees these as required uploads in their portal."
      />
      <CardBody>
        <form onSubmit={requestDoc} className="flex gap-2 mb-4">
          <input
            placeholder="e.g. Voided check, Operating agreement…"
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            className="flex-1 h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={!newDoc.trim()}>
            <SendIcon size={13} /> Request
          </Button>
        </form>

        {docs.length === 0 ? (
          <p className="text-[12px] text-fg-muted text-center py-4">No documents requested yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-md border border-border bg-bg-muted/40 px-3 py-2"
              >
                <DocIcon size={14} className="text-fg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-fg truncate">{d.name}</p>
                  {d.note && <p className="text-[11px] text-fg-muted truncate">{d.note}</p>}
                </div>
                <StatusPill
                  tone={
                    d.status === 'approved'
                      ? 'success'
                      : d.status === 'rejected'
                        ? 'warning'
                        : d.status === 'received'
                          ? 'info'
                          : 'neutral'
                  }
                  dot
                >
                  {d.status}
                </StatusPill>
                <span className="text-[11px] text-fg-muted shrink-0 hidden md:inline">
                  {ago(d.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ActivityTimelineCard({ biz }: { biz: OnboardingBusiness }) {
  const sorted = useMemo(
    () =>
      [
        ...biz.timeline,
        ...biz.comms.map((c) => ({
          id: c.id,
          at: c.at,
          type: 'comm' as const,
          body: `${c.channel.toUpperCase()} ${c.direction === 'outbound' ? '→' : '←'} ${c.subject ?? c.body}`,
          actor: c.sentBy ?? 'business',
        })),
      ].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [biz],
  );
  return (
    <Card>
      <CardHeader
        title="Activity timeline"
        description="Every event in the onboarding lineage — actions, comms, system events. Audit-grade lineage."
      />
      <CardBody>
        <ul className="space-y-3">
          {sorted.map((t) => (
            <li key={t.id} className="flex gap-3 text-[12px]">
              <span className="size-6 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center shrink-0">
                {t.type === 'system' ? (
                  <ClockIcon size={11} />
                ) : t.type === 'human' ? (
                  <UsersIcon size={11} />
                ) : t.type === 'comm' ? (
                  <SendIcon size={11} />
                ) : (
                  <CheckIcon size={11} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-fg">{t.body}</p>
                <p className="text-[10px] text-fg-muted mt-0.5 uppercase tracking-wider font-semibold">
                  {new Date(t.at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {t.actor}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function CommsComposerCard({ biz }: { biz: OnboardingBusiness }) {
  const [channel, setChannel] = useState<'push' | 'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const presets: Record<typeof channel, string[]> = {
    email: [
      'Request additional KYB documentation',
      'Highsale onboarding incomplete — reminder',
      'MyCAMP onboarding incomplete — reminder',
      'Final review — confirm settlement bank',
    ],
    sms: ['Reminder: complete EazePay configuration', 'Quick check-in — anything blocking you?'],
    push: [
      'Action needed — upload remaining documents',
      'Tap to resume your EazePay configuration',
    ],
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSent(`${channel.toUpperCase()} sent to ${biz.primaryContact.name}`);
    setSubject('');
    setBody('');
    setTimeout(() => setSent(null), 3500);
  };

  return (
    <Card>
      <CardHeader
        title="Send a message"
        description="Push notification, email, or SMS — all logged to the activity timeline."
      />
      <CardBody>
        {sent && (
          <Banner intent="success" className="mb-3">
            {sent}
          </Banner>
        )}
        <div className="flex gap-1 mb-3">
          {(['email', 'sms', 'push'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={
                'flex-1 h-8 rounded-md text-[11px] uppercase tracking-wider font-semibold transition-colors ' +
                (channel === c
                  ? 'bg-[#0d1530] text-white'
                  : 'text-fg-secondary bg-bg-muted hover:bg-bg-muted/60')
              }
            >
              {c}
            </button>
          ))}
        </div>

        <form onSubmit={send} className="space-y-2.5">
          {channel === 'email' && (
            <input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            />
          )}
          <textarea
            placeholder={
              channel === 'push'
                ? 'Notification body — keep under 120 characters'
                : channel === 'sms'
                  ? '160 character SMS body'
                  : 'Email body'
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={channel === 'email' ? 5 : 3}
            className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px]"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-fg-muted">
              Logged to timeline + audit chain. {biz.primaryContact.email} ·{' '}
              {biz.primaryContact.phone}
            </p>
            <Button size="sm" type="submit" disabled={!body.trim()}>
              <SendIcon size={13} /> Send
            </Button>
          </div>
        </form>

        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted mb-2">
            Quick templates
          </p>
          <ul className="space-y-1">
            {presets[channel].map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => setBody(p)}
                  className="text-left w-full text-[12px] text-fg-secondary hover:text-fg hover:bg-bg-muted/60 px-2 py-1 rounded"
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

function NotesCard({ biz }: { biz: OnboardingBusiness }) {
  const [notes, setNotes] = useState(biz.notes);
  const [draft, setDraft] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setNotes((rows) => [
      {
        id: `n_${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        author: 'EAZE Admin',
        body: draft.trim(),
      },
      ...rows,
    ]);
    setDraft('');
  };

  return (
    <Card>
      <CardHeader title="Internal notes" description="Private to the EazePay team." />
      <CardBody>
        <form onSubmit={add} className="mb-3 space-y-2">
          <textarea
            placeholder="Drop a note for the team…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[12px]"
          />
          <div className="flex items-center justify-end">
            <Button size="sm" type="submit" disabled={!draft.trim()}>
              Add note
            </Button>
          </div>
        </form>
        {notes.length === 0 ? (
          <p className="text-[12px] text-fg-muted text-center py-2">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border bg-bg-muted/30 px-3 py-2">
                <p className="text-[12px] text-fg leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-fg-muted mt-1.5 uppercase tracking-wider font-semibold">
                  {n.author} · {ago(n.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ThrottleCard() {
  const [maxAppsPerDay, setMaxAppsPerDay] = useState(50);
  const [requireManualReview, setRequireManualReview] = useState(false);
  const [requireDualApproval, setRequireDualApproval] = useState(true);

  return (
    <Card>
      <CardHeader
        title="Throttle + review controls"
        description="Operator-only. Applies once the business goes live."
      />
      <CardBody className="space-y-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-[0.16em] font-semibold text-fg-muted mb-1">
            Max applications per day
          </span>
          <input
            type="number"
            value={maxAppsPerDay}
            onChange={(e) => setMaxAppsPerDay(Number(e.target.value))}
            className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
          />
        </label>
        <Toggle
          label="Manual review every application"
          on={requireManualReview}
          onChange={setRequireManualReview}
          hint="Block auto-approval; route every offer-accept to ops."
        />
        <Toggle
          label="Dual approval on payouts"
          on={requireDualApproval}
          onChange={setRequireDualApproval}
          hint="Two operators sign off before any settlement runs."
        />
      </CardBody>
    </Card>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[11px] text-fg-muted leading-snug">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={
          'h-5 w-9 rounded-full transition-colors relative shrink-0 ' +
          (on ? 'bg-[#0d1530]' : 'bg-bg-muted')
        }
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow ' +
            (on ? 'left-4' : 'left-0.5')
          }
        />
      </button>
    </div>
  );
}

function DangerZoneCard() {
  return (
    <Card>
      <CardHeader title="Destructive actions" description="Confirmation required. Audit-logged." />
      <CardBody className="space-y-2">
        <Button variant="secondary" size="sm" fullWidth>
          Pause onboarding
        </Button>
        <Button variant="secondary" size="sm" fullWidth>
          Reset KYB checks
        </Button>
        <Button variant="danger" size="sm" fullWidth>
          Decline + close
        </Button>
      </CardBody>
    </Card>
  );
}
