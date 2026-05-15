import type { ReactNode } from 'react';
import '@eazepay/ui/styles/globals.css';

export const metadata = {
  title: 'EazePay — Finance your purchase',
  description:
    'Apply for embedded finance in minutes. Real offers, real lenders, no impact to your credit score until you accept.',
};

export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return (
    // `data-pii="true"` is a signal for DLP browser extensions, screen
    // recorders, and screen-share apps (e.g., a future EazePay support
    // co-browse tool) to mask the page contents by default. It carries
    // no functional behavior on its own — it's a hint flag. SOC 2 CC6.7
    // controls reference this attribute as the "page-level PII marker".
    <html lang="en" data-theme="light">
      <body data-pii="true">{children}</body>
    </html>
  );
}
