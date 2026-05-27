/**
 * Boot-time environment validation.
 *
 * Problem this solves
 * -------------------
 * Before this module existed, `DEMO_COOKIE_SECRET` and friends were
 * checked lazily — the first request to hit `signDemoPreset` /
 * `readSignedDemoPreset` would throw if the secret was missing. In
 * production that meant: a clean `railway up` to a freshly-provisioned
 * environment would deploy successfully, accept the first user request,
 * read the cookie in middleware, throw inside `readSignedDemoPreset`,
 * return a 500, and stay that way until someone noticed and added the
 * env var. The platform was effectively single-bit-flip away from a
 * cold-start outage.
 *
 * `assertProdEnv()` runs at module-load time on the server (imported
 * from `middleware.ts` which Next.js evaluates once per worker boot).
 * If any REQUIRED secret is missing or malformed, the process throws
 * before accepting a single request — Railway's health check fails,
 * the deploy is marked unhealthy, and traffic continues hitting the
 * previous revision. That's the desired behaviour: a half-configured
 * deploy should never serve.
 *
 * In non-production (NODE_ENV !== 'production'), the validator only
 * surfaces a one-line warning per missing variable so local dev + CI
 * keep working with the dev placeholder secrets baked into
 * `demo-cookie.ts` and `account-cookie.ts`.
 *
 * What "REQUIRED" means here
 * --------------------------
 * Variables in the REQUIRED set are ones whose absence causes a runtime
 * throw at request time. Variables in the RECOMMENDED set are ones
 * whose absence silently downgrades functionality (e.g. Resend → emails
 * are logged not sent) — we warn but don't refuse to boot.
 *
 * Adding a new env var
 * --------------------
 * 1. Add it to `.env.example` with a concrete example value.
 * 2. Add it to REQUIRED here if missing breaks production, RECOMMENDED
 *    otherwise.
 * 3. If REQUIRED, document the unit of failure in `failureMode` so the
 *    error message tells future-you what specifically breaks.
 */

const MIN_SECRET_BYTES = 32;

interface RequiredVar {
  /** Env variable name (also the import string in code). */
  name: string;
  /**
   * What breaks if this is missing in prod. Surfaces in the thrown
   * error so the operator doesn't have to grep the codebase.
   */
  failureMode: string;
  /**
   * Optional validator — returns `null` on success, an error string on
   * failure. Defaults to "must be set + non-empty".
   */
  validate?: (value: string) => string | null;
}

interface RecommendedVar {
  name: string;
  /** Human-readable description of what degrades when missing. */
  degradationMode: string;
}

/**
 * Variables that must be set in production. Missing any of these
 * throws at module-load.
 */
const REQUIRED: ReadonlyArray<RequiredVar> = [
  {
    name: 'DEMO_COOKIE_SECRET',
    failureMode:
      'middleware throws on every request that reads the demo cookie — site is 500 from the first hit',
    validate: (v) =>
      v.length < MIN_SECRET_BYTES
        ? `must be at least ${MIN_SECRET_BYTES} chars (use \`openssl rand -hex 32\`)`
        : null,
  },
  {
    name: 'ACCOUNT_COOKIE_SECRET',
    failureMode: 'real signed-in sessions cannot be verified — every authenticated request 500s',
    validate: (v) =>
      v.length < MIN_SECRET_BYTES
        ? `must be at least ${MIN_SECRET_BYTES} chars (use \`openssl rand -hex 32\`)`
        : null,
  },
  {
    name: 'NEXT_PUBLIC_APP_ORIGIN',
    failureMode: 'email templates and CSRF checks construct broken absolute URLs',
    validate: (v) =>
      /^https?:\/\//.test(v) ? null : 'must include the scheme (e.g. https://app.eazepay.com)',
  },
  // NOTE: MICAMP_WEBHOOK_SECRET, HIGHSALE_WEBHOOK_SECRET, and
  // ALLOWED_ORIGINS were previously REQUIRED here (added by the
  // ship-ready hardening sprint). Downgraded to RECOMMENDED until the
  // real MiCamp + HighSale partner integrations are wired with the
  // partners' actual signing keys — they are presently stub
  // integrations, so the strict throw blocked deploy without any real
  // security gain. Runtime guards in lib/micamp/client.ts +
  // lib/highsale/client.ts already fail-closed on unset secrets at
  // request time (returning 503 with no signature trust), so the soft
  // posture here is bounded. Re-upgrade to REQUIRED when partner
  // webhooks go live.
];

/**
 * Variables whose absence silently downgrades functionality. We warn
 * but do not throw — production may legitimately run without Stripe
 * (demo mode) or Resend (logging mode) during early ops.
 */
const RECOMMENDED: ReadonlyArray<RecommendedVar> = [
  {
    name: 'MICAMP_WEBHOOK_SECRET',
    degradationMode:
      'MiCamp webhook signature verification rejects all inbound events — stub integration is no-op anyway',
  },
  {
    name: 'HIGHSALE_WEBHOOK_SECRET',
    degradationMode:
      'HighSale webhook signature verification rejects all inbound events — stub integration is no-op anyway',
  },
  {
    name: 'ALLOWED_ORIGINS',
    degradationMode:
      'origin-guard falls back to same-origin policy only; defence-in-depth weakened, SameSite=Lax + CSRF cookie still in place',
  },
  {
    name: 'NEXT_PUBLIC_API_URL',
    degradationMode: 'BFF round-trip falls back to localhost:3000',
  },
  {
    name: 'NEXT_PUBLIC_BFF_ROOT',
    degradationMode: 'api-client falls back to NEXT_PUBLIC_API_URL',
  },
  {
    name: 'RESEND_API_KEY',
    degradationMode: 'invite + invoice emails log to stdout instead of sending',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    degradationMode: 'Stripe setup-fee endpoint returns a stub redirect (no charge)',
  },
  {
    name: 'DATABASE_URL',
    degradationMode:
      'application read/write APIs return 503 and dashboards fall back to localStorage',
  },
  // ────────────────────────────────────────────────────────────────────
  // OpenTelemetry (production-readiness P0 — partner-portal is the
  // actually-deployed app; without these env vars there are zero
  // distributed traces across webhook dispatch / decision engine /
  // MiCamp calls). Helpers in lib/observability/tracing.ts degrade to
  // no-op spans when OTEL_EXPORTER_OTLP_ENDPOINT is unset — the app
  // keeps running, but the trace-by-id link in every safeLog line goes
  // missing and a partner complaint of "the charge took 12 seconds"
  // has no upstream span to point at.
  // ────────────────────────────────────────────────────────────────────
  {
    name: 'OTEL_EXPORTER_OTLP_ENDPOINT',
    degradationMode: 'no distributed traces',
  },
  {
    name: 'OTEL_SERVICE_NAME',
    degradationMode: 'no distributed traces (defaults to eazepay-partner-portal)',
  },
  {
    name: 'OTEL_TRACES_SAMPLER',
    degradationMode:
      'no distributed traces (defaults to parentbased_always_on — fine until traffic exceeds collector budget)',
  },
  {
    name: 'OTEL_TRACES_SAMPLER_ARG',
    degradationMode:
      'no distributed traces (defaults to 1.0 = 100% sampling; dial down after the first fortnight)',
  },
];

let evaluated = false;
/**
 * Validator result.
 *
 *   • `ok: true`  → boot is safe. `warnings` may still be non-empty —
 *     they indicate degraded functionality (e.g. RESEND_API_KEY unset →
 *     emails log instead of send) but do not block the process.
 *   • `ok: false` → at least one REQUIRED variable is missing or
 *     invalid. In production this would have thrown before reaching
 *     this state; in dev we return the result so the caller can see it.
 */
export type EnvAssertionResult =
  | { ok: true; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };
let lastSummary: EnvAssertionResult | null = null;

/**
 * Validates the process env. Called once at module-load by
 * `middleware.ts` (which Next.js evaluates once per worker boot). Safe
 * to call repeatedly — subsequent calls return the cached result.
 *
 * Behaviour:
 *   • In production: throws on any REQUIRED failure, with a single
 *     aggregated error listing every missing/invalid variable.
 *   • In non-production: writes a one-line warning per failure to
 *     stderr but does not throw, so local dev + CI keep working with
 *     the dev placeholder secrets.
 *
 * Returns the validation result so callers can branch on it (used by
 * the health probe to surface env-status to operators).
 */
export function assertProdEnv(): EnvAssertionResult {
  if (evaluated) return lastSummary!;
  evaluated = true;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const v of REQUIRED) {
    const value = process.env[v.name];
    if (!value || value.length === 0) {
      errors.push(`${v.name}: not set (${v.failureMode})`);
      continue;
    }
    const validateErr = v.validate?.(value) ?? null;
    if (validateErr) errors.push(`${v.name}: ${validateErr} (${v.failureMode})`);
  }

  for (const v of RECOMMENDED) {
    const value = process.env[v.name];
    if (!value || value.length === 0) {
      warnings.push(`${v.name}: not set — ${v.degradationMode}`);
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  // `next build` evaluates middleware at build time without secrets set in
  // CI. We log everything as warnings during build but skip the throw —
  // the throw still fires on the first worker boot at runtime (which is
  // when REQUIRED env vars actually need to exist).
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

  if (errors.length > 0) {
    const banner = isProd
      ? `[env] ${errors.length} required environment variable(s) are missing or invalid — refusing to boot`
      : `[env] ${errors.length} required environment variable(s) are missing or invalid — running with dev placeholders`;
    // eslint-disable-next-line no-console
    console.error(banner);
    for (const e of errors) {
      // eslint-disable-next-line no-console
      console.error(`  • ${e}`);
    }
    if (warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[env] ${warnings.length} recommended variable(s) missing (functionality degraded):`,
      );
      for (const w of warnings) {
        // eslint-disable-next-line no-console
        console.warn(`  • ${w}`);
      }
    }
    if (isProd && !isBuildTime) {
      // Throwing here aborts module evaluation, which aborts middleware
      // initialisation, which fails the Next.js worker boot. Railway's
      // healthcheck never goes green and the rotation stays on the
      // previous revision — a half-configured deploy never serves.
      //
      // Skipped during `next build` (NEXT_PHASE === 'phase-production-build')
      // so CI can produce a build artifact without holding the prod
      // secrets — the throw still fires at runtime on first request.
      throw new Error(
        `partner-portal refusing to boot: ${errors.length} required env var(s) invalid. ` +
          `See stderr above for details.`,
      );
    }
    lastSummary = { ok: false, errors, warnings };
    return lastSummary;
  }

  // SEC-209 — dev-only escape hatches MUST never be true in prod.
  // The MiCamp webhook signature verifier exposes a bypass flag for
  // local-dev replay (no real HMAC available offline). If the flag
  // leaks into a prod env, every webhook is accepted unsigned. We
  // refuse to boot rather than serve traffic with the bypass live.
  //
  // Both names checked: the original `MICAMP_WEBHOOK_INSECURE_ALLOW`
  // (legacy) and the renamed `MICAMP_DEV_SKIP_WEBHOOK_SIG` (new — name
  // is explicit so a future operator can't misread the intent).
  if (process.env.NODE_ENV === 'production') {
    const insecureFlags: Array<[string, string | undefined]> = [
      ['MICAMP_WEBHOOK_INSECURE_ALLOW', process.env.MICAMP_WEBHOOK_INSECURE_ALLOW],
      ['MICAMP_DEV_SKIP_WEBHOOK_SIG', process.env.MICAMP_DEV_SKIP_WEBHOOK_SIG],
    ];
    for (const [name, val] of insecureFlags) {
      if (val && /^(1|true|yes|on)$/i.test(val)) {
        const msg = `[env] ${name}=${val} in production — refusing to boot. This flag disables webhook signature verification and is dev-only.`;
        // eslint-disable-next-line no-console
        console.error(msg);
        throw new Error(msg);
      }
    }
  }

  if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[env] ${warnings.length} recommended variable(s) missing (functionality degraded):`,
    );
    for (const w of warnings) {
      // eslint-disable-next-line no-console
      console.info(`  • ${w}`);
    }
  }

  // No required errors → boot is safe. Warnings (if any) are reported
  // above but don't flip `ok` — they describe degraded mode, not unsafe
  // mode.
  lastSummary = { ok: true, warnings };
  return lastSummary;
}

/**
 * Test-only reset so specs can exercise the validator with different
 * env shapes without process restarts.
 */
export function _resetEnvAssertion(): void {
  evaluated = false;
  lastSummary = null;
}
