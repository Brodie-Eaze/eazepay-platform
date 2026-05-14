import { PageHeader, PageBody, Card, CardBody, StatusPill } from '@eazepay/ui/web';

/**
 * Infrastructure → Events. Live tail of the domain-event bus
 * (EventBridge in prod, in-process emitter in dev). Filterable by
 * eventType / actor / target for forensics.
 */
export default function EventsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Events' }]}
        title="Events"
        description="Live tail of the domain event bus — filterable by type, actor, and target."
      />
      <PageBody>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <StatusPill tone="info">Coming soon</StatusPill>
              <span className="text-fg-muted text-[13px]">
                Will subscribe to AuditOutbox + EventBridge fanout; menu position
                matches the Lovable reference.
              </span>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
