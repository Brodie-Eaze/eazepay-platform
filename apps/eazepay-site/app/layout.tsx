import '@eazepay/ui/styles/globals.css';
import './site.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://eazepay.com'),
  title: {
    default: 'EazePay — The payment orchestration platform',
    template: '%s · EazePay',
  },
  description:
    'EazePay is the orchestration layer beneath every payment brand — one API for processing, a lender marketplace, seven autonomous agents and merchant-direct settlement. MedPay, TradePay and CoachPay run on the same rail.',
  keywords: [
    'payment orchestration',
    'embedded finance',
    'lender marketplace',
    'point-of-sale financing',
    'agentic platform',
    'merchant settlement',
  ],
  openGraph: {
    title: 'EazePay — The payment orchestration platform',
    description:
      'One rail beneath every vertical brand. Processing, a lender marketplace, seven agents and merchant-direct settlement — orchestrated.',
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
