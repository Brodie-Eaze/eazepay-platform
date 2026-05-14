import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';
import { Shell } from './_shell';

export const metadata = {
  title: 'EazePay — Admin Console',
  description: 'EazePay internal operations & underwriting workspace.',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-bg text-fg">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
