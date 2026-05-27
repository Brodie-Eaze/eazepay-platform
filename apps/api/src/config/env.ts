import { z } from 'zod';

/**
 * ──────────────────────────────────────────────────────────────────────
 * Cron leader election — DUAL MECHANISM (advisory locks + env flag)
 * ──────────────────────────────────────────────────────────────────────
 * The API runs three background crons:
 *   1. webhook dispatcher  — every minute   (services/webhook)
 *   2. audit-outbox drain  — every minute   (services/audit)
 *   3. repayment collection — daily 08:00 UTC (services/payment)
 *
 * PRIMARY mechanism: Postgres advisory locks.
 * Each cron handler calls `pg_try_advisory_lock(<lockId>)` at entry
 * (services/audit/src/internal/cron-leader.service.ts). Only ONE
 * replica per tick acquires the lock — even if every replica has
 * `CRON_LEADER=true`. The lock is held for the duration of the tick
 * and released in a finally; a process crash releases at session end.
 *
 * Reserved lock IDs:
 *   - 41011 — webhook dispatcher
 *   - 41012 — audit-outbox drain
 *   - 41013 — daily collection
 *
 * The advisory lock is the load-bearing distributed-lock guarantee.
 * It makes the cron correct under ANY env-flag misconfiguration —
 * including a Railway / k8s rolling deploy that accidentally leaves
 * `CRON_LEADER=true` on two replicas.
 *
 * SECONDARY mechanism: `CRON_LEADER` env flag (belt-and-braces).
 * In a multi-replica deploy you SHOULD still set this `true` on
 * exactly one replica and `false` on the rest. Reasons:
 *   - Cheaper than acquiring a DB lock just to discover you're not
 *     the leader (the env-flag check is O(1) before the lock attempt).
 *   - Operator kill-switch: flipping it `false` immediately stops
 *     every cron in a replica without needing to bounce Postgres or
 *     wait for the next tick.
 *   - Defense-in-depth: even if the advisory lock infrastructure had
 *     a bug, the env flag would still pin work to one replica.
 *
 * The per-cron flags (WEBHOOK_DISPATCHER_ENABLED, AUDIT_DRAIN_ENABLED,
 * COLLECTION_CRON_ENABLED) remain as fine-grained kill-switches so an
 * operator can disable a single misbehaving cron during an incident
 * without taking the whole leader down. `CRON_LEADER=false` overrides
 * them: leader-off means leader-off, no exceptions.
 *
 * Default is `false` so a fresh deploy of N replicas is safe — nothing
 * runs until you flip the leader on.
 * ──────────────────────────────────────────────────────────────────────
 */

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    AUTH_PROVIDER: z.enum(['local', 'cognito']).default('local'),
    JWT_ISSUER: z.string().default('https://auth.eazepay.local'),
    JWT_AUDIENCE: z.string().default('eazepay-api'),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15min
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30), // 30d
    KEY_MANAGER: z.enum(['local', 'kms']).default('local'),
    /** 32-byte (64 hex chars) KEK for LocalKeyManager. Generate via:
     *  openssl rand -hex 32. Required when KEY_MANAGER=local. */
    LOCAL_KEK_HEX: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex chars (32 bytes)')
      .optional(),
    KYC_PROVIDER: z.enum(['mock', 'alloy', 'persona']).default('mock'),
    ESIGN_PROVIDER: z.enum(['mock', 'docusign', 'dropbox_sign']).default('mock'),
    KYB_PROVIDER: z.enum(['mock', 'middesk', 'alloy']).default('mock'),
    PAYMENT_PROVIDER: z.enum(['mock', 'modern_treasury', 'stripe', 'partner_bank']).default('mock'),
    BANK_ACCOUNT_PROVIDER: z.enum(['mock', 'plaid', 'mx', 'finicity']).default('mock'),
    DEVICE_RISK_PROVIDER: z
      .enum(['mock', 'sift', 'castle', 'seon', 'plaid_signal'])
      .default('mock'),
    IDENTITY_RISK_PROVIDER: z.enum(['mock', 'emailage', 'telesign', 'ekata']).default('mock'),
    /** Object storage backend. local-fs is dev only. */
    OBJECT_STORAGE: z.enum(['local-fs', 's3']).default('local-fs'),
    /** Bucket id for compliance documents. */
    COMPLIANCE_DOC_BUCKET: z.string().default('eazepay-compliance-docs-dev'),
    /** Root dir when OBJECT_STORAGE=local-fs. */
    LOCAL_FS_STORAGE_ROOT: z.string().default('./tmp/object-storage'),
    /** HMAC secret for LocalFs presigned URLs (dev only). */
    LOCAL_FS_STORAGE_SIGNING_SECRET: z.string().default('dev-only-replace-me'),
    /** Public base URL for LocalFs presigned downloads (must match the
     *  /v1/dev-storage route mounted by apps/api). */
    LOCAL_FS_STORAGE_PUBLIC_URL: z.string().url().default('http://localhost:3000/v1/dev-storage'),
    /** Umbrella leader-election switch for ALL background crons in this
     *  process. See the block comment at the top of this file. Set true
     *  on exactly ONE replica in a multi-replica deploy; false on the
     *  rest. When false, every @Cron in the API no-ops. Default false so
     *  scaling out is safe by construction. */
    CRON_LEADER: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    /** When true, this process runs the daily collection cron. In a
     *  multi-replica deploy, only ONE replica should set this. Acts as a
     *  per-cron kill-switch under the CRON_LEADER umbrella — both must
     *  be true for the cron to fire. */
    COLLECTION_CRON_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    /** Per-process flag for the outbound webhook dispatcher cron. */
    WEBHOOK_DISPATCHER_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    /**
     * Audit sink: 'local-fs' for dev, 's3' (Object Lock, WORM) in prod.
     *
     * 'dynamodb' was the previous prod target but DynamoDB alone does
     * not meet SOC2 CC7.2 WORM-archive requirements — the production
     * topology pipes drained rows into S3 with Object Lock in
     * compliance mode (1-year minimum retention, root-cannot-delete).
     * DynamoDB stays in the design as a hot tier in front of S3 but
     * is no longer the canonical sink the auditor reviews.
     *
     * The S3 adapter currently lives as a stub at
     * services/audit/src/adapters/s3-worm.adapter.ts — see that file's
     * docstring + docs/runbooks/kek-rotation.md.
     */
    AUDIT_SINK: z.enum(['local-fs', 'dynamodb', 's3']).default('local-fs'),
    /** Local directory the S3 stub adapter writes to, mimicking the
     *  shape of a real S3 PUT (key + body). Dev-only — production
     *  swaps in the real S3 client. */
    AUDIT_S3_STUB_ROOT: z.string().default('./dlq/audit-s3-pending'),
    AUDIT_LOCAL_FS_ROOT: z.string().default('./tmp/audit-sink'),
    /** Per-process flag for the audit-drain cron. */
    AUDIT_DRAIN_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    /**
     * Billing service kill-switch. When false (the default), the
     * BillingModule registers as a no-op — no controllers, no service,
     * no /billing/* surface. Lets us ship the code to main with the
     * rest of the platform unaffected; flip on per-environment once
     * Resend + Stripe are wired and the accounts team is ready.
     */
    BILLING_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    /**
     * Real-time event bus + SSE streams (master fleet + per-app).
     * When false, the module registers no controllers + no Redis
     * subscriber. Flip on per-env once Redis is reachable and the
     * Live Activity strip / sales-rep ticker are ready to consume.
     */
    EVENTS_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    OTEL_SERVICE_NAME: z.string().default('eazepay-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    /**
     * Comma-separated list of explicit CORS origins. In dev we default
     * to the partner-portal + Lovable preview hosts so the BFF round-trip
     * works out of the box. In production the value MUST be supplied
     * explicitly via `CORS_ALLOWED_ORIGINS` — see the superRefine() at
     * the bottom of this schema (SEC-047).
     *
     * `CORS_ALLOWED_ORIGINS` is the canonical, operator-facing name in
     * production; `CORS_ORIGINS` is its dev-friendly alias and stays
     * for backwards compatibility with existing dev / staging configs.
     * Either may be set; values are merged with `CORS_ALLOWED_ORIGINS`
     * taking precedence when both are present.
     */
    CORS_ORIGINS: z
      .string()
      .default(
        [
          'http://localhost:3001', // partner-portal
          'http://localhost:3002', // merchant-dashboard
          'http://localhost:3003', // consumer-web
          'http://localhost:3004', // admin-console
        ].join(','),
      )
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    /**
     * Production CORS allowlist (SEC-047). Comma-separated explicit
     * origins, e.g. `https://app.eazepay.com,https://partners.eazepay.com,https://api.eazepay.com`.
     * No default in production — superRefine() below refuses to boot
     * with an empty allowlist when `NODE_ENV=production`.
     *
     * In non-production this is optional and additive on top of
     * CORS_ORIGINS / CORS_ORIGIN_PATTERNS.
     */
    CORS_ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((s) =>
        s
          ? s
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      ),
    /**
     * Regex patterns (one per line / comma-separated) for dynamic CORS
     * origins. Used to whitelist Lovable preview URLs without enumerating
     * each commit hash. Example: `^https://.*\.lovable\.app$,^https://.*\.lovableproject\.com$`.
     *
     * SEC-047: the Lovable wildcard is a credential-bearing surface
     * (we send `credentials: true`). It MUST stay out of production —
     * superRefine() below clears the patterns to `[]` whenever
     * NODE_ENV=production unless the operator deliberately re-supplies
     * patterns via this env. The default below only fires for
     * non-production environments.
     */
    CORS_ORIGIN_PATTERNS: z
      .string()
      .optional()
      .transform((s) => {
        if (s !== undefined) {
          return s
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
        }
        // Default Lovable preview wildcards — applied only in non-prod
        // by the superRefine() below.
        return ['^https://.*\\.lovable\\.app$', '^https://.*\\.lovableproject\\.com$'];
      }),
    /**
     * HMAC-SHA256 shared secret for the Highsale webhook receiver.
     * Required in non-development environments; the receiver refuses to
     * serve requests when unset.
     */
    HIGHSALE_WEBHOOK_SECRET: z.string().min(16).optional(),
    /**
     * SEC-034 — enforce a ±5 minute replay window on inbound webhooks.
     *
     * Threat: pre-fix, the Highsale + eSign receivers verified the HMAC
     * but accepted ANY timestamp. A captured webhook (logged by a
     * misconfigured proxy, leaked from a pen-test report, or harvested
     * by a partner with momentary log access) could be replayed 6 months
     * later and would still verify — re-scoring an old application,
     * re-firing a contract signature event, etc.
     *
     * Fix: include the timestamp in the HMAC input as `<ts>.<rawBody>`,
     * and reject when the timestamp drifts more than 300 seconds from
     * our clock. New senders MUST send `x-eazepay-timestamp` (or the
     * provider equivalent). Old senders without the header fail closed.
     *
     * Default is `true` so production is safe by default. Set to `false`
     * only during a short rollover window if a partner needs time to
     * adopt the timestamp header; never leave it disabled long-term.
     */
    WEBHOOK_REPLAY_WINDOW_ENFORCED: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(true),
    /**
     * SEC-046 — Swagger UI basic-auth credentials. In staging the
     * `/docs` + `/docs-json` routes are wrapped in a tiny basic-auth
     * middleware so the full API surface isn't exposed to anyone with
     * the URL. Both fields must be set; if either is missing in
     * staging, Swagger refuses to mount at all (logged at warn).
     *
     * Production: Swagger never mounts.
     * Development: open, credentials ignored.
     * Staging: required-or-no-Swagger.
     */
    SWAGGER_DOCS_USER: z.string().min(1).optional(),
    SWAGGER_DOCS_PASS: z.string().min(8).optional(),
  })
  // ────────────────────────────────────────────────────────────────────
  // Production safety rails (SEC-031, SEC-047). Composed at the schema
  // level so a misconfigured production deploy refuses to boot rather
  // than silently degrading to dev-grade security posture.
  // ────────────────────────────────────────────────────────────────────
  .superRefine((env, ctx) => {
    // SEC-116: staging is treated identically to production for the
    // security-posture checks below. Pre-fix, staging was treated as
    // non-prod and inherited the Lovable wildcard CORS allowlist,
    // which meant `*.lovable.app` could `fetch(...credentials:'include')`
    // against a staging deployment. Staging deployments mirror prod
    // data shape and frequently mirror real partner credentials, so
    // the lockdown must match prod.
    const isHardened = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    if (!isHardened) return;

    // PE-KEK-01: KEY_MANAGER must be `kms` in production. The
    // LocalKeyManager loads its 32-byte KEK from env / disk, which is
    // an unacceptable key-storage posture for SOC2 CC6.1 + PCI DSS 3.5
    // (key material must live in an HSM / KMS managed boundary, not
    // alongside the application). Pre-fix, env.ts only emitted a
    // console.warn and allowed boot; this refuses boot outright.
    //
    // Staging is intentionally NOT included here — staging may run
    // against a sandbox KMS or use LocalKeyManager with a rotated
    // staging-only KEK, depending on the deploy. Operators flip this
    // explicitly per environment via `KEY_MANAGER=kms`.
    if (env.NODE_ENV === 'production' && env.KEY_MANAGER !== 'kms') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KEY_MANAGER'],
        message:
          'KEY_MANAGER must be `kms` when NODE_ENV=production. ' +
          'LocalKeyManager stores the KEK on disk / in env, which fails ' +
          'SOC2 CC6.1 and PCI DSS 3.5. See docs/runbooks/kek-rotation.md.',
      });
    }

    // PE-AUDIT-01: AUDIT_SINK must be `s3` in production. The
    // local-fs sink writes JSON-lines to a pod-local disk — neither
    // durable nor immutable, and lost on the next deploy. SOC2 CC7.2
    // (audit log integrity) requires an immutable, WORM-grade sink
    // (S3 Object Lock in compliance mode). Pre-fix, env.ts allowed
    // any value through and the AuditModule factory threw at runtime
    // AFTER boot succeeded — meaning a misconfigured production
    // instance would serve traffic with audit drains silently failing.
    if (env.NODE_ENV === 'production' && env.AUDIT_SINK !== 's3') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUDIT_SINK'],
        message:
          'AUDIT_SINK must be `s3` when NODE_ENV=production. ' +
          'local-fs writes to ephemeral pod disk and dynamodb alone ' +
          'does not satisfy SOC2 CC7.2 WORM-archive requirements. ' +
          'See docs/runbooks/kek-rotation.md (sibling runbook for ' +
          'audit-sink rotation lands in a follow-up).',
      });
    }

    // SEC-031: a mock e-sign provider in production would let anyone
    // with a `dev-mock` literal flip envelope status to `signed`.
    if (env.ESIGN_PROVIDER === 'mock') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ESIGN_PROVIDER'],
        message:
          'ESIGN_PROVIDER=mock is forbidden when NODE_ENV=production or staging. Set it to docusign or dropbox_sign.',
      });
    }

    // SEC-047 + SEC-116: in hardened environments CORS must be locked
    // to an explicit allowlist supplied via CORS_ALLOWED_ORIGINS.
    if (env.CORS_ALLOWED_ORIGINS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ALLOWED_ORIGINS'],
        message:
          'CORS_ALLOWED_ORIGINS must list at least one explicit origin in production or staging (e.g. https://app.eazepay.com,https://partners.eazepay.com). The dev Lovable wildcard is refused.',
      });
    }
  })
  // After validation, compile pattern strings into RegExp objects,
  // strip Lovable wildcards when running in a hardened environment
  // (production or staging — SEC-116), and merge the canonical allowed
  // origins so existing consumers (apps/api/src/main.ts) keep working
  // without re-plumbing. SEC-047 + SEC-116.
  .transform((env) => {
    const isHardened = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    const patternStrings = isHardened
      ? // In hardened envs: only honour patterns the operator
        // explicitly set. The default Lovable wildcards are dropped.
        process.env.CORS_ORIGIN_PATTERNS
        ? env.CORS_ORIGIN_PATTERNS
        : []
      : env.CORS_ORIGIN_PATTERNS;
    // CORS_ALLOWED_ORIGINS is the canonical hardened-env surface; in
    // hardened envs we use it exclusively (ignoring dev defaults baked
    // into CORS_ORIGINS). In non-hardened envs we merge so localhost
    // still works even if an operator also supplies CORS_ALLOWED_ORIGINS.
    const mergedOrigins = isHardened
      ? env.CORS_ALLOWED_ORIGINS
      : Array.from(new Set([...env.CORS_ORIGINS, ...env.CORS_ALLOWED_ORIGINS]));
    return {
      ...env,
      CORS_ORIGINS: mergedOrigins,
      CORS_ORIGIN_PATTERNS: patternStrings.map((p) => new RegExp(p)),
    };
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export const loadEnv = (): Env => {
  if (cached) return cached;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    // Fail loud and early; never start the app with invalid config.
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', result.error.format());
    throw new Error('Environment validation failed');
  }
  cached = result.data;
  return cached;
};
