import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';
import { Shell } from './_shell';

export const metadata = {
  title: 'EazePay — Merchant Dashboard',
  description: 'Embedded finance for your checkout.',
};

export default function MerchantLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
