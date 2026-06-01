/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eazepay/ui'],
  // Resolve `.js` specifiers in the workspace lib barrels back to their
  // `.ts` sources (NodeNext tsc emits the `.js`; webpack can't find the
  // on-disk `.ts` without this alias). Mirrors consumer-web / partner-portal.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  // ────────────────────────────────────────────────────────────────────
  // Security headers (eazepay-site). This is a marketing surface — it
  // collects no PII and renders no third-party widgets — so the policy is
  // strict but allows the self-hosted-via-CDN web fonts the shared
  // globals.css pulls in (Inter + JetBrains Mono from Google Fonts):
  //   • style-src adds fonts.googleapis.com for the @import stylesheet,
  //     and 'unsafe-inline' for the per-element animation-delay / transform
  //     style attributes the lead-flow + 3D scenes use.
  //   • font-src adds fonts.gstatic.com for the actual font files.
  //   • script-src 'unsafe-inline' is the standard Next 14 App Router
  //     hydration-bootstrap trade-off (tighten to nonce when Next ships RFC).
  //   • frame-ancestors 'none' + X-Frame-Options DENY stop clickjacking.
  // ────────────────────────────────────────────────────────────────────
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
export default nextConfig;
