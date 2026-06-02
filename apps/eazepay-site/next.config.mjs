// Static-export mode (EXPORT=1) targets GitHub Pages: fully static `out/`,
// served from a project subpath, no server (so the security headers() — which
// `output: 'export'` forbids — are dropped; Pages sets its own).
const isExport = process.env.EXPORT === '1';
const basePath = process.env.PAGES_BASE || '';

// Security headers for the server (Railway) build. Marketing surface — no PII,
// no third-party widgets — strict CSP that still allows the Google-hosted web
// fonts the shared globals.css imports.
async function securityHeaders() {
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
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eazepay/ui'],
  ...(isExport
    ? {
        output: 'export',
        basePath,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        // Standalone output for the Railway Docker image.
        output: 'standalone',
        outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
        headers: securityHeaders,
      }),
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
};
export default nextConfig;
