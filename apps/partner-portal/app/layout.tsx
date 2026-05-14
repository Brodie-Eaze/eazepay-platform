import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';
import { Shell } from './_shell';
import { Providers } from './providers';

export const metadata = {
  title: 'EazePay · Partner Portal',
  description: 'Embedded finance orchestration for lender partners.',
};

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-bg text-fg">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
