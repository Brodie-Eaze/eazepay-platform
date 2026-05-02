import { Card, Banner } from '@eazepay/ui/web';
import { spacing, lightColors } from '@eazepay/ui/tokens';

/**
 * Application queue. Real fetch via the admin API client (uses
 * @AdminOnly endpoints) lands when admin SSO is wired. Today the
 * shell is in place so navigation + layout are correct.
 */
export default function AdminQueue() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: spacing.xl }}>Queue</h1>
      <Banner intent="info" title="Read-only queue">
        Approve / decline mutations are bearer + admin-guarded. Decline reasons must be selected
        from the Reg B / FCRA taxonomy. Amounts ≥ $25,000 open a dual-control compliance review.
      </Banner>
      <div style={{ height: spacing.xl }} />
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: lightColors.textMuted }}>
              <th style={th}>Application</th>
              <th style={th}>User</th>
              <th style={th}>Amount</th>
              <th style={th}>Risk score</th>
              <th style={th}>Status</th>
              <th style={th}>Submitted</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: spacing.xxl, textAlign: 'center', color: lightColors.textMuted }}>
                No items. Queue populates as consumers submit applications.
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const th: React.CSSProperties = {
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.5,
  paddingBottom: spacing.sm,
  borderBottom: `1px solid ${lightColors.borderDefault}`,
};
