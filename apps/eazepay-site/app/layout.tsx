import '@eazepay/ui/styles/globals.css';
import './site.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://eazepay.com'),
  title: {
    default: 'EazePay — The financial infrastructure behind every brand',
    template: '%s · EazePay',
  },
  description:
    'EazePay is the financial infrastructure behind the brand — prequalification, agents, a lender marketplace and payment processing on one platform. MedPay, TradePay, CoachPay and VetPay are brand wrappers on the same infrastructure.',
  keywords: [
    'financial infrastructure',
    'embedded finance',
    'prequalification',
    'lender marketplace',
    'point-of-sale financing',
    'payment processing',
    'agentic platform',
  ],
  openGraph: {
    title: 'EazePay — The financial infrastructure behind every brand',
    description:
      'One infrastructure behind every brand — prequalification, agents, a lender marketplace and payment processing. MedPay, TradePay, CoachPay and VetPay run on the same rail.',
    type: 'website',
    siteName: 'EazePay',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#080C1B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {/* No-JS / pre-hydration safety: if the Reveal islands never mount,
            force every reveal target fully visible so content is never hidden. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
