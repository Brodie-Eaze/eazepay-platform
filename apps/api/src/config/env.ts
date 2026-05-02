import { z } from 'zod';

const EnvSchema = z.object({
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
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30), // 30d
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
  PAYMENT_PROVIDER: z
    .enum(['mock', 'modern_treasury', 'stripe', 'partner_bank'])
    .default('mock'),
  BANK_ACCOUNT_PROVIDER: z
    .enum(['mock', 'plaid', 'mx', 'finicity'])
    .default('mock'),
  /** When true, this process runs the daily collection cron. In a
   *  multi-replica deploy, only ONE replica should set this. */
  COLLECTION_CRON_ENABLED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
  OTEL_SERVICE_NAME: z.string().default('eazepay-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
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
