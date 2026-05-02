import { Card, Button, Input } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

export default function ApplicationLinksPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Application links</h1>
      <Card>
        <h3 style={{ marginTop: 0 }}>Generate a link</h3>
        <p style={{ color: lightColors.textSecondary }}>
          Send the resulting URL to your customer. Links expire (default 24h) and are single-use
          once redeemed.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md, maxWidth: 720 }}>
          <Input label="Amount (USD)" placeholder="e.g. 5000" />
          <Input label="Term (months)" placeholder="24" />
          <Input label="Customer email (optional)" type="email" />
        </div>
        <div style={{ marginTop: spacing.lg }}>
          <Button>Create link</Button>
        </div>
      </Card>
    </div>
  );
}
