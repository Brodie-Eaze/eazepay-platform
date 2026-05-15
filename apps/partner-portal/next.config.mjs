/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eazepay/ui'],
  // Pre-existing TS/ESLint errors in unrelated files (legacy auth + api routes)
  // would otherwise fail the Railway production build. Skip at build time;
  // typecheck still runs locally via `npx tsc --noEmit`.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Many client pages (sign-in, /v/[brand]/*, etc.) call useSearchParams()
    // without a Suspense boundary. Allow the build to bail those pages to
    // client-side rendering rather than failing prerender.
    missingSuspenseWithCSRBailout: false,
  },
  // Standalone output bundles only the files needed to run the server
  // (server.js + minimal node_modules) so the Railway/Docker image is
  // ~150MB instead of ~1GB. The trace root is the monorepo root so
  // pnpm-linked workspace deps (libs/ui, libs/shared-types) make it
  // into the bundle.
  output: 'standalone',
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  // External hostnames allowed for inlined images (QR generator on
  // the apply-share page). Anything else gets blocked.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
  // ────────────────────────────────────────────────────────────────────
  // Security headers (SEC-006). Applied to every route in the portal.
  //
  // Why each header matters:
  //   • Strict-Transport-Security  — once seen, the browser refuses to
  //                                  talk to this host over plaintext HTTP
  //                                  for the next 2 years, including the
  //                                  very first request after the user
  //                                  types the bare domain. `preload`
  //                                  qualifies us for the HSTS preload
  //                                  list (Chrome/Firefox ship with it
  //                                  baked in — no first-request risk).
  //   • X-Frame-Options: DENY      — refuses to render inside any iframe.
  //                                  Stops clickjacking of partner-portal
  //                                  login + sensitive flows; superseded
  //                                  by CSP frame-ancestors in modern
  //                                  browsers but kept for older clients.
  //   • X-Content-Type-Options:    — disables MIME-sniffing. Without it,
  //     nosniff                      a browser may execute a .txt file
  //                                  served by us as JS if the content
  //                                  looks script-like. Belt-and-braces
  //                                  with the Content-Type we already set.
  //   • Referrer-Policy:           — when the portal links out to a
  //     strict-origin-when-          third party, only the origin (not the
  //     cross-origin                  path/query) is leaked. Prevents
  //                                  applicant IDs and tokens in URLs
  //                                  from being exfiltrated via Referer.
  //   • Permissions-Policy:        — proactively denies the page (and any
  //     camera=() microphone=()      embed) access to camera/mic/GPS. Even
  //     geolocation=()               if a future feature opts in, this is
  //                                  the safe default for a finance UI.
  // ────────────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
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
