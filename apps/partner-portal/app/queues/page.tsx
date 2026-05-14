import { PageHeader, PageBody, Card, CardBody, StatusPill } from '@eazepay/ui/web';

/**
 * Infrastructure → Queues. Listed in the Master Command Centre sidebar
 * to match the Lovable admin-portal layout. Substantive UI lands once
 * the BullMQ + Redis queue inspector ships in services/workers.
 */
export default function QueuesPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Queues' }]}
        title="Queues"
        description="Background job queues — BullMQ on Redis. Inspect depth, retry counts, and worker health."
      />
      <PageBody>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <StatusPill tone="info">Coming soon</StatusPill>
              <span className="text-fg-muted text-[13px]">
                Wired into the menu so the layout matches the Lovable reference; the
                inspector UI lands once the workers service is plumbed.
              </span>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
