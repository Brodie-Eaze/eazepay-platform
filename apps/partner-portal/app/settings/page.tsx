'use client';
import { useState } from 'react';
import { PageHeader, PageBody, Card, CardBody, Button } from '@eazepay/ui/web';

/**
 * Settings — direct port of Lovable's `/settings` page.
 *
 *   ACCOUNT
 *   Settings
 *   ┌── Business Information ──┐
 *   │   Name / Email / Phone   │
 *   │   [Save Changes]         │
 *   └──────────────────────────┘
 *   ┌── Notifications ─────────┐
 *   │  ☐ Email Notifications   │
 *   │  ☐ Application Updates   │
 *   │  ☐ Funding Alerts        │
 *   └──────────────────────────┘
 */

export default function SettingsPage() {
  const [biz, setBiz] = useState({
    name: 'EAZE Partner',
    email: 'admin@eaze.test',
    phone: '(555) 555-1212',
  });
  const [notif, setNotif] = useState({ email: true, applicationUpdates: true, funding: true });
  const [saved, setSaved] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Account' }, { label: 'Settings' }]}
        title="Settings"
        description="Manage your account, business information, and notification preferences."
      />
      <PageBody>
        <div className="space-y-4 max-w-3xl">
          {/* Business Information */}
          <Card>
            <CardBody>
              <h2 className="text-[16px] font-semibold text-fg">Business Information</h2>
              <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Field label="Business Name">
                  <Input
                    value={biz.name}
                    onChange={(e) => setBiz((s) => ({ ...s, name: e.target.value }))}
                  />
                </Field>
                <Field label="Contact Email">
                  <Input
                    type="email"
                    value={biz.email}
                    onChange={(e) => setBiz((s) => ({ ...s, email: e.target.value }))}
                  />
                </Field>
                <Field label="Phone" className="md:col-span-2 md:max-w-xs">
                  <Input
                    type="tel"
                    value={biz.phone}
                    onChange={(e) => setBiz((s) => ({ ...s, phone: e.target.value }))}
                  />
                </Field>
                <div className="md:col-span-2 flex items-center gap-3">
                  <Button size="sm" type="submit">
                    Save Changes
                  </Button>
                  {saved && <span className="text-[12px] text-fg">Saved.</span>}
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Notifications */}
          <Card>
            <CardBody>
              <h2 className="text-[16px] font-semibold text-fg">Notifications</h2>
              <div className="mt-4 space-y-3">
                <Toggle
                  label="Email Notifications"
                  hint="Receive updates via email"
                  value={notif.email}
                  onChange={(v) => setNotif((s) => ({ ...s, email: v }))}
                />
                <Toggle
                  label="Application Updates"
                  hint="Get notified on status changes"
                  value={notif.applicationUpdates}
                  onChange={(v) => setNotif((s) => ({ ...s, applicationUpdates: v }))}
                />
                <Toggle
                  label="Funding Alerts"
                  hint="Alerts when deals are funded"
                  value={notif.funding}
                  onChange={(v) => setNotif((s) => ({ ...s, funding: v }))}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[14px] text-fg outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20"
    />
  );
}

function Toggle({
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
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
      <div>
        <p className="text-[14px] font-semibold text-fg">{label}</p>
        <p className="text-[12px] text-fg-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={
          'relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 ' +
          (value ? 'bg-[#0d1530]' : 'bg-border')
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
