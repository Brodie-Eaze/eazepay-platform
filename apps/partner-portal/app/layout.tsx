import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import '@eazepay/ui/styles/globals.css';
import { Shell } from './_shell';
import { Providers } from './providers';

// Single typeface across every surface — landings, brand portals,
// master operator, sign-in. Loaded once at the root so per-page
// font-family declarations can drop and inherit cleanly.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'EazePay · Partner Portal',
  description: 'Embedded finance orchestration for lender partners.',
};

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={inter.variable}>
      <body
        className="bg-bg text-fg"
        style={{ fontFamily: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif' }}
      >
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
