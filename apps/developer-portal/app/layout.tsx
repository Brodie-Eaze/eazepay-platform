import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';

export const metadata = {
  title: 'EazePay — Developer Portal',
  description: 'Build embedded financing into your checkout in 30 minutes.',
};

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-bg text-fg">{children}</body>
    </html>
  );
}
