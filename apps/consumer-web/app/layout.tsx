import type { ReactNode } from 'react';
import { lightColors } from '@eazepay/ui/tokens';

export const metadata = { title: 'EazePay' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: lightColors.bgDefault,
          color: lightColors.textPrimary,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
