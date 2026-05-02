import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
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
