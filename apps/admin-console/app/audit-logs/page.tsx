import { Card } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

export default function AuditLogsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Audit logs</h1>
      <Card>
        <p style={{ marginTop: 0, color: lightColors.textSecondary }}>
          Filter by target type, action prefix, actor, or time window. Rows drain to the
          immutable hash-chained sink every minute; the Postgres copy is the live view.
        </p>
      </Card>
    </div>
  );
}
