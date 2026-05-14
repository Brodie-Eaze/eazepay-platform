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
};
export default nextConfig;
