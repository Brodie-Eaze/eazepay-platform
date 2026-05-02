import { Card } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

/**
 * Server component placeholder. Real implementation fetches via the
 * merchant-scoped API key set up at onboarding; today the empty
 * state ships so the navigation works end-to-end.
 */
export default function ApplicationsList() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Applications</h1>
      <Card>
        <p style={{ color: lightColors.textSecondary, marginTop: 0 }}>
          No applications yet. Create an application link from the <strong>Application links</strong> tab
          and share it with a customer.
        </p>
      </Card>
    </div>
  );
}
