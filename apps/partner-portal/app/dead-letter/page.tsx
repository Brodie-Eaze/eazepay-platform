import { PageHeader, PageBody, Card, CardBody, StatusPill } from '@eazepay/ui/web';

/**
 * Infrastructure → Dead Letter. Shows messages parked after exceeding
 * retry budgets — webhook deliveries, outbound notifications, lender
 * callbacks. Source is the webhook + notification DLQ tables.
 */
export default function DeadLetterPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Dead Letter' }]}
        title="Dead Letter"
        description="Messages parked after retry exhaustion — inspect, replay, or discard."
      />
      <PageBody>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <StatusPill tone="warning">Coming soon</StatusPill>
              <span className="text-fg-muted text-[13px]">
                Surfaces failed webhook deliveries + outbound notification DLQ rows
                once the dispatcher cron is wired into this view.
              </span>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
