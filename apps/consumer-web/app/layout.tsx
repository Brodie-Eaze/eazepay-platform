import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';

export const metadata = {
  title: 'EazePay — Finance your purchase',
  description: 'Apply for embedded finance in minutes. Real offers, real lenders, no impact to your credit score until you accept.',
};

export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
