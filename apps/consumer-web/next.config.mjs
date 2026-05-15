/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eazepay/ui'],
  // ────────────────────────────────────────────────────────────────────
  // Security headers (consumer-web). Mirrors partner-portal SEC-006 but
  // tightened further because the consumer-web surface accepts SSN,
  // DOB, bank account info from real consumers. Every header here exists
  // to defeat a specific real-world attack:
  //
  //   • Strict-Transport-Security  — once seen, the browser refuses to
  //                                  talk to this host over plaintext
  //                                  HTTP for the next 2 years, including
  //                                  the very first request after the
  //                                  user types the bare domain.
  //                                  `preload` qualifies us for the HSTS
  //                                  preload list (Chrome/Firefox ship
  //                                  with it baked in, so the first
  //                                  request is HTTPS too).
  //   • Content-Security-Policy    — a defense-in-depth XSS killer. If a
  //                                  bug ever lets an attacker inject a
  //                                  <script src="evil.com/x.js">, the
  //                                  browser blocks the fetch because
  //                                  evil.com isn't on the allowlist.
  //                                  Consumer-web doesn't render any
  //                                  third-party widgets or inline
  //                                  styles from external sources, so
  //                                  the policy is much stricter than
  //                                  partner-portal's. style-src is
  //                                  'self' only (no Swagger / Tailwind
  //                                  inline-style preview). script-src
  //                                  allows 'unsafe-inline' ONLY because
  //                                  Next.js inlines the hydration boot
  //                                  script; this is a known Next.js
  //                                  trade-off and is the standard
  //                                  posture for Next 14 + App Router.
  //                                  When Next adds nonce-based script
  //                                  injection (RFC), tighten this.
  //   • X-Frame-Options: DENY      — refuses to render inside any
  //                                  iframe. Stops clickjacking of the
  //                                  apply flow where an attacker frames
  //                                  the apply page under a fake "Win an
  //                                  iPhone" overlay and harvests SSN
  //                                  through invisible click hijacks.
  //                                  Superseded by CSP frame-ancestors
  //                                  in modern browsers but kept for
  //                                  older clients (Safari 14, etc.).
  //   • X-Content-Type-Options:    — disables MIME-sniffing. Without it,
  //     nosniff                      a browser may execute a .txt file
  //                                  served by us as JS if the content
  //                                  looks script-like. Belt-and-braces
  //                                  with the Content-Type we already
  //                                  set.
  //   • Referrer-Policy:           — when the apply page links out to a
  //     strict-origin-when-          third party (Plaid, partner lender),
  //     cross-origin                  only the origin is leaked, never
  //                                  the path or query string. Stops
  //                                  applicationIds and tokens from
  //                                  leaving via Referer headers.
  //   • Permissions-Policy:        — proactively denies the page access
  //     camera=() microphone=()      to camera/mic/GPS. Even if a future
  //     geolocation=()               feature opts in, this is the safe
  //                                  default for a consumer-finance UI.
  // ────────────────────────────────────────────────────────────────────
  async headers() {
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' is required for Next 14 App Router hydration
      // bootstrap scripts. Migrate to nonce-based when Next ships RFC.
      "script-src 'self' 'unsafe-inline'",
      // Stricter than partner-portal: consumer-web has no Swagger UI
      // and no third-party widget that injects inline style strings,
      // so we can lock style-src to 'self' only. Tailwind ships its
      // styles as compiled CSS at /_next/static/css/* — also 'self'.
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // XHR + fetch goes to the BFF route on the same origin AND the
      // partner-portal consent endpoint when consumer-web is hosted on
      // a different domain. Tighten in prod by hardcoding the partner
      // portal origin.
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
