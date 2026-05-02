import { Card } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

export default function MerchantOverview() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg }}>
        <Kpi label="Applications (30d)" value="—" />
        <Kpi label="Approval rate" value="—" />
        <Kpi label="Funded volume (30d)" value="—" />
        <Kpi label="Settlement T+1" value="—" />
      </div>
      <div style={{ marginTop: spacing.xxl }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Get started</h3>
          <p style={{ color: lightColors.textSecondary }}>
            Create an application link, send it to a customer, and watch their journey progress in
            real time. Webhooks for state changes are available under <strong>Webhooks</strong>.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div style={{ fontSize: 12, color: lightColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: spacing.xs }}>{value}</div>
    </Card>
  );
}
