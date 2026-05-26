'use client';
/**
 * /settings/notifications — stub Sprint G page. The Notifications
 * panel (topbar bell) deep-links here from the footer + the MoreMenu
 * has a "Notification settings" item that lands here.
 *
 * Functionality lands in a follow-up sprint. Today this page
 * communicates intent (which categories the operator will be able
 * to mute) without yet wiring the toggle persistence.
 */
import { PageHeader, PageBody, Card, CardBody } from '@eazepay/ui/web';

const CATEGORIES = [
  {
    id: 'applications',
    title: 'Applications',
    body: 'New submissions, approvals, fundings, declines (last 7 days).',
  },
  {
    id: 'partners',
    title: 'Partners',
    body: 'Onboarding completion, partner suspension, MID issuance.',
  },
  {
    id: 'alerts',
    title: 'Alerts',
    body: 'Webhook failure rate, SLO breach, DLQ depth, CVE found.',
  },
];

export default function NotificationSettingsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Notifications' }]}
        title="Notification preferences"
        description="Pick which categories surface in the topbar bell and (eventually) by email."
      />
      <PageBody>
        <div className="space-y-3 max-w-2xl">
          {CATEGORIES.map((c) => (
            <Card key={c.id}>
              <CardBody className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{c.title}</div>
                  <p className="text-[12px] text-fg-muted mt-1">{c.body}</p>
                </div>
                {/* Toggle stub — wiring in next sprint. */}
                <span className="text-[11px] uppercase tracking-wider text-fg-muted shrink-0">
                  On
                </span>
              </CardBody>
            </Card>
          ))}
          <p className="text-[12px] text-fg-muted">
            Per-category mute + email/Slack delivery preferences ship in the next iteration. Today
            every category is on by default.
          </p>
        </div>
      </PageBody>
    </>
  );
}
