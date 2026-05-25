import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'EazePay platform overview · how it all works',
  description:
    'Top-to-bottom visual walkthrough of the EazePay platform — from landing page to funded loan, every screen.',
};

export default function PlatformOverviewLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: '#0A0E1A',
          color: '#E2E8F0',
        }}
      >
        {children}
      </body>
    </html>
  );
}
