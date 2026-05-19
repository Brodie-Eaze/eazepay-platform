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
];

/**
 * Variables whose absence silently downgrades functionality. We warn
 * but do not throw — production may legitimately run without Stripe
 * (demo mode) or Resend (logging mode) during early ops.
 */
const RECOMMENDED: ReadonlyArray<RecommendedVar> = [
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
    if (isProd) {
      // Throwing here aborts module evaluation, which aborts middleware
      // initialisation, which fails the Next.js worker boot. Railway's
      // healthcheck never goes green and the rotation stays on the
      // previous revision — a half-configured deploy never serves.
      throw new Error(
        `partner-portal refusing to boot: ${errors.length} required env var(s) invalid. ` +
          `See stderr above for details.`,
      );
    }
    lastSummary = { ok: false, errors, warnings };
    return lastSummary;
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
