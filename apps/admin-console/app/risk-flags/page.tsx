import { Card } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

export default function RiskFlagsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Risk flags</h1>
      <Card>
        <p style={{ marginTop: 0, color: lightColors.textSecondary }}>
          Open flags only. Filter by severity (low / medium / high / critical). Resolutions are
          confirmed or cleared and write to the audit log.
        </p>
      </Card>
    </div>
  );
}
