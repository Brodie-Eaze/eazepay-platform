import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Banner,
  Button,
  StatusPill,
  DataRow,
  KeyIcon,
  ShieldIcon,
} from '@eazepay/ui/web';
import { piiUnmaskRequests } from '../../lib/mock-data';

export default function PiiPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'JIT PII unmask' }]}
        title="JIT PII unmask"
        description="Time-boxed PII access. Every request needs a reason + approver, and every read is logged separately to the audit chain."
        actions={<Button leadingIcon={<KeyIcon size={16} />}>Request unmask</Button>}
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          The default for every applicant record is <strong>masked</strong>. Unmask grants expire in
          30 minutes by default. After expiry, the field re-locks and the next read requires a fresh
          request. This is what gives EazePay a defensible audit posture under GLBA Safeguards.
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {piiUnmaskRequests.map((req) => (
            <Card key={req.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <ShieldIcon size={14} />
                    Request <span className="font-mono">{req.id}</span>
                  </span>
                }
                description={`For subject ${req.subject}`}
                action={
                  req.status === 'approved' ? (
                    <StatusPill tone="success">Approved</StatusPill>
                  ) : (
                    <StatusPill tone="warning" dot>
                      Pending
                    </StatusPill>
                  )
                }
              />
              <CardBody>
                <DataRow label="Requested by" value={req.requestedBy} />
                <DataRow
                  label="Requested at"
                  value={new Date(req.requestedAt).toLocaleString('en-US')}
                />
                <DataRow
                  label="Fields"
                  value={<span className="font-mono text-[12px]">{req.fields.join(', ')}</span>}
                />
                <DataRow label="Reason" value={req.reason} />
                {req.status === 'approved' && (
                  <>
                    <DataRow label="Approver" value={req.approver} />
                    <DataRow
                      label="Expires"
                      value={new Date(req.expiresAt!).toLocaleString('en-US')}
                    />
                  </>
                )}
                <div className="flex gap-2 mt-3">
                  {req.status === 'pending' ? (
                    <>
                      <Button size="sm" variant="secondary">
                        Reject
                      </Button>
                      <Button size="sm">Approve (30m)</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary">
                        Revoke
                      </Button>
                      <Button size="sm">Read (logged)</Button>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
