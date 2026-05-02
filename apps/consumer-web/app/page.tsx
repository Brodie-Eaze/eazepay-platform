import Link from 'next/link';
import { Button, Card } from '@eazepay/ui/web';
import { spacing } from '@eazepay/ui/tokens';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: spacing.giant }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: spacing.lg }}>EazePay</h1>
      <p style={{ fontSize: 20, lineHeight: 1.5, marginBottom: spacing.xxl }}>
        Apply for finance in minutes. Compare real offers. Repay on your terms.
      </p>
      <Card>
        <p style={{ marginTop: 0 }}>
          The hosted apply experience opens via a merchant link — go to{' '}
          <code>/apply/[slug]/[token]</code> with a real link, or sign in to manage an existing
          loan.
        </p>
        <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.md }}>
          <Link href="/sign-in"><Button variant="primary">Sign in</Button></Link>
          <Link href="/sign-up"><Button variant="secondary">Create account</Button></Link>
        </div>
      </Card>
    </main>
  );
}
