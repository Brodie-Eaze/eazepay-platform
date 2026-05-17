/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eazepay/ui'],
  // Resolve `.js` specifiers in workspace lib barrels back to their `.ts`
  // sources. TypeScript with `moduleResolution: NodeNext` requires the
  // explicit `.js` extension on relative ESM imports (`./brands.js`); the
  // tsc + Node ESM toolchains accept that natively, but webpack 5 does
  // not — without this alias, the partner-portal build trips on
  // "Can't resolve './brands.js'" because the on-disk file is `brands.ts`.
  // Mapping `.js` → `[.ts, .tsx, .js]` keeps both toolchains happy
  // without forking the source.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  // TypeScript: now at 0 errors across the whole partner-portal surface
  // (the production hardening sprint closed the long tail). Build-time
  // typecheck stays ON so any new TS error fails the Railway deploy
  // loudly — engineers get real feedback rather than a green build with
  // silent type drift. Flip back to `true` only if you are knowingly
  // shipping during a partial refactor and have a follow-up ticket.
  typescript: { ignoreBuildErrors: false },
  // ESLint at build is OFF because ESLint isn't wired across the
  // workspace yet (see HANDOFF.md "Engineer day-1 follow-ups"). Flip
  // this to `false` after installing eslint + the recommended plugins.
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
    remotePatterns: [{ protocol: 'https', hostname: 'api.qrserver.com' }],
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
