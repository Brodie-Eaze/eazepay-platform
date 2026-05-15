'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button as _Button,
  ShieldIcon,
  KeyIcon,
  CheckIcon,
  AlertIcon,
  ClockIcon,
  XIcon,
  ArrowRightIcon,
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

/**
 * Security & 2FA — operator account security center. Two-factor toggle,
 * device sessions, recovery codes, recent sign-ins, and account lock.
 */

interface SessionRow {
  id: string;
  device: string;
  browser: string;
  os: string;
  city: string;
  ip: string;
  lastActive: string; // relative
  isCurrent: boolean;
}

const SESSIONS_SEED: SessionRow[] = [
  { id: 's_001', device: 'MacBook Pro',  browser: 'Chrome 138',  os: 'macOS 14.7', city: 'Sydney, AU',   ip: '203.0.113.41',  lastActive: 'now',      isCurrent: true  },
  { id: 's_002', device: 'iPhone 16',    browser: 'Safari Mobile', os: 'iOS 17.4',  city: 'Sydney, AU',   ip: '49.181.22.118', lastActive: '2h ago',   isCurrent: false },
  { id: 's_003', device: 'iPad Air',     browser: 'Safari 17',   os: 'iPadOS 17.4', city: 'Sydney, AU',   ip: '49.181.22.118', lastActive: '3d ago',   isCurrent: false },
  { id: 's_004', device: 'Windows PC',   browser: 'Edge 138',    os: 'Windows 11',  city: 'Brisbane, AU', ip: '101.119.4.88',  lastActive: '12d ago',  isCurrent: false },
];

const SIGN_INS = [
  { ts: '2026-05-14T22:14:00Z', city: 'Sydney, AU',   ip: '203.0.113.41',  outcome: 'success' as const },
  { ts: '2026-05-14T08:01:00Z', city: 'Sydney, AU',   ip: '49.181.22.118', outcome: 'success' as const },
  { ts: '2026-05-13T19:42:00Z', city: 'Brisbane, AU', ip: '101.119.4.88',  outcome: 'success' as const },
  { ts: '2026-05-12T03:18:00Z', city: 'Unknown',      ip: '185.220.101.17', outcome: 'blocked' as const },
  { ts: '2026-05-11T15:09:00Z', city: 'Sydney, AU',   ip: '203.0.113.41',  outcome: 'success' as const },
];

export default function SecurityPage() {
  const [tfa, setTfa] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS_SEED);
  const [toast, setToast] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    flash('Session revoked');
  }

  function revokeAll() {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    flash('All other sessions signed out');
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Account' }, { label: 'Security & 2FA' }]}
        title="Security & 2FA"
        description="Two-factor authentication, device sessions, recovery codes, and recent sign-in activity for this operator account."
        actions={
          <Button size="sm" variant="secondary" onClick={() => flash('Account lock requires 2-of-3 admin approval')}>
            <AlertIcon size={12} /> Lock account
          </Button>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="2FA status" value={tfa ? 'Enabled' : 'Disabled'} tone={tfa ? 'success' : 'danger'} hint={tfa ? 'authenticator app' : 'turn on now'} />
          <Stat label="Active sessions" value={String(sessions.length)} hint="across all devices" />
          <Stat label="Sign-ins (30d)" value="42" hint="0 anomalies" tone="success" />
          <Stat label="Last password change" value="42d ago" hint="2026-04-03" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Two-factor authentication"
              description="Time-based one-time-password from an authenticator app (Authy, 1Password, Google Authenticator)."
              action={
                <span className="flex items-center gap-1.5">
                  <span className={'size-2 rounded-full ' + (tfa ? 'bg-success' : 'bg-danger')} />
                  <span className="text-[11px] font-semibold text-fg-secondary">
                    {tfa ? 'Active' : 'Off'}
                  </span>
                </span>
              }
            />
            <CardBody>
              <div className="space-y-3">
                <ToggleRow
                  label="Require 2FA at every sign-in"
                  hint="Recommended for Master operator accounts."
                  value={tfa}
                  onChange={(v) => {
                    setTfa(v);
                    flash(v ? '2FA enabled' : '2FA disabled (audit logged)');
                  }}
                />
                <ToggleRow
                  label="Trust this device for 30 days"
                  hint="Skip the 2FA prompt on this Mac for 30 days. Tap revoke to reset trust."
                  value={false}
                  onChange={() => flash('Device trust updated')}
                />
                <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowRecovery((v) => !v)}>
                    <KeyIcon size={12} /> {showRecovery ? 'Hide' : 'Show'} recovery codes
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => flash('New TOTP secret generated, scan the QR')}>
                    Regenerate authenticator
                  </Button>
                </div>
                {showRecovery && (
                  <div className="mt-3 rounded-lg border border-border bg-bg-elevated p-3">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
                      8 single-use recovery codes
                    </p>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
                      {['4HX9-2QPN', 'KM3W-LRT8', 'P7VR-9BCQ', '5JKD-XN24', 'WT8P-3MQR', '9NHA-BFLS', 'QC4D-7K2T', 'X5R3-MWPH'].map((c) => (
                        <span key={c} className="px-2 py-1 rounded bg-bg-muted text-fg">{c}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-fg-muted mt-2">
                      Store these somewhere safe. Each code can only be used once.
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Password"
              description="Last changed 42 days ago. EazePay enforces a 16-character minimum + uniqueness check against the breach corpus."
            />
            <CardBody className="space-y-3">
              <PasswordRow label="Current password" placeholder="Enter current password" />
              <PasswordRow label="New password" placeholder="Min 16 characters" />
              <PasswordRow label="Confirm new password" placeholder="Repeat new password" />
              <div className="pt-2 border-t border-border flex justify-end">
                <Button size="sm" variant="primary" onClick={() => flash('Password change recorded (audit logged)')}>
                  Update password
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader
            title={`Active sessions (${sessions.length})`}
            description="Devices currently signed in to this operator account."
            action={
              <Button size="sm" variant="secondary" onClick={revokeAll} disabled={sessions.length <= 1}>
                Sign out all other devices
              </Button>
            }
          />
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-3">Device</span>
              <span className="col-span-3">Browser / OS</span>
              <span className="col-span-2">Location</span>
              <span className="col-span-2">IP</span>
              <span className="col-span-1">Last active</span>
              <span className="col-span-1 text-right">Action</span>
            </div>
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id} className="grid grid-cols-12 items-center px-5 py-3 text-[12px]">
                  <div className="col-span-3 font-medium text-fg flex items-center gap-2">
                    {s.device}
                    {s.isCurrent && <StatusPill tone="success" dot>This device</StatusPill>}
                  </div>
                  <div className="col-span-3 text-fg-secondary">
                    {s.browser}
                    <span className="text-fg-muted"> · {s.os}</span>
                  </div>
                  <div className="col-span-2 text-fg-secondary">{s.city}</div>
                  <div className="col-span-2 font-mono text-[11px] text-fg-muted">{s.ip}</div>
                  <div className="col-span-1 text-fg-muted">{s.lastActive}</div>
                  <div className="col-span-1 text-right">
                    {!s.isCurrent && (
                      <button onClick={() => revokeSession(s.id)} className="text-[11px] text-danger hover:underline">
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader
            title="Recent sign-in activity"
            description="Last 5 sign-in attempts. Anomalies surface here first."
            action={
              <Link href="/audit?action=user.login" className="text-[12px] text-accent hover:underline inline-flex items-center gap-1">
                Open full audit log <ArrowRightIcon size={11} />
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {SIGN_INS.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className={'size-2 rounded-full ' + (s.outcome === 'success' ? 'bg-success' : 'bg-danger')} />
                    <span className="text-fg font-medium">{s.city}</span>
                    <span className="text-fg-muted">·</span>
                    <span className="font-mono text-[11px] text-fg-muted">{s.ip}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-fg-muted inline-flex items-center gap-1">
                      <ClockIcon size={10} />
                      {s.ts.replace('T', ' ').slice(0, 16)}Z
                    </span>
                    <StatusPill tone={s.outcome === 'success' ? 'success' : 'danger'}>
                      {s.outcome}
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2">
          <CheckIcon size={14} />
          {toast}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: StatusTone }) {
  const accent =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[20px] font-bold tracking-tight leading-none ${accent}`}>{value}</p>
      {hint && <p className="text-[10px] text-fg-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-fg">{label}</p>
        <p className="text-[11px] text-fg-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={
          'relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5 ' +
          (value ? 'bg-fg' : 'bg-border')
        }
      >
        <span
          className={
            'absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transform transition ' +
            (value ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </label>
  );
}

function PasswordRow({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted mb-1.5">{label}</span>
      <input
        type="password"
        placeholder={placeholder}
        className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus:border-border-strong"
      />
    </label>
  );
}
