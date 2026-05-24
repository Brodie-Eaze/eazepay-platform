import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'EZ Check · Pre-qualification engine',
  description:
    'Fill your calendar with buyers, not form fillers. Pre-qualification agents, smart form, smart routing — drop a single widget into your funnel.',
};

export default function EzCheckRootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={{
          fontFamily:
            'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
