import { Card, Button, Input } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

const EVENTS = [
  'application.offers_presented',
  'application.declined',
  'application.contracted',
  'application.funded',
  'application.funding_failed',
  'loan.repayment.collected',
  'loan.repayment.failed',
];

export default function WebhooksPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Webhooks</h1>
      <Card>
        <h3 style={{ marginTop: 0 }}>Add an endpoint</h3>
        <Input label="HTTPS URL" placeholder="https://your-app.example.com/eazepay/webhook" />
        <p style={{ color: lightColors.textSecondary, marginTop: spacing.lg }}>Subscribe to events:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
          {EVENTS.map((e) => (
            <label key={e} style={{ display: 'inline-flex', gap: 6, fontSize: 14 }}>
              <input type="checkbox" /> <code>{e}</code>
            </label>
          ))}
        </div>
        <div style={{ marginTop: spacing.lg }}>
          <Button>Save endpoint</Button>
        </div>
      </Card>
      <div style={{ height: spacing.lg }} />
      <Card>
        <h3 style={{ marginTop: 0 }}>Signature verification</h3>
        <p style={{ color: lightColors.textSecondary, marginTop: 0 }}>
          Each delivery includes <code>X-EazePay-Signature</code> (HMAC-SHA256 over
          <code> X-EazePay-Timestamp.body</code>) and <code>X-EazePay-Event-Id</code> for dedupe.
          Reject anything outside a 5-minute clock skew.
        </p>
      </Card>
    </div>
  );
}
