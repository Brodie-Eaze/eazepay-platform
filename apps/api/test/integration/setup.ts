/**
 * ─────────────────────────────────────────────────────────────────────
 * Integration-test setup
 * ─────────────────────────────────────────────────────────────────────
 *
 * What this module owns:
 *
 *   1. Bringing up a real Postgres + Redis instance for tests. Two
 *      paths in priority order:
 *
 *        a. `@testcontainers/postgresql` + `@testcontainers/redis` if
 *           installed. Containers come up on random host ports, so
 *           multiple test workers can run in parallel without colliding.
 *        b. The `docker-compose.test.yml` stack at repo root, brought
 *           up via `docker compose -f docker-compose.test.yml up -d
 *           --wait`. Fixed host ports (5433 / 6380); incompatible with
 *           parallel test-worker pools.
 *
 *      If neither path is available, `bootIntegrationStack()` throws
 *      with an explicit message rather than silently passing fake tests.
 *
 *   2. Running `prisma migrate deploy` against the freshly-spun-up DB
 *      so the schema matches production.
 *
 *   3. Exposing `wipeDatabase()` — a fast TRUNCATE across every user
 *      table — so each test starts from a known empty state.
 *
 *   4. Providing `createTestingApp()` — boots the real NestJS
 *      `AppModule` with DI overrides for whatever the spec needs
 *      (e.g. capturing OTP codes that the dev notification adapter
 *      would otherwise only log).
 *
 * The helpers are designed for use inside `beforeAll` / `afterAll` hooks
 * in the individual `.spec.ts` files. Each spec is responsible for
 * calling `wipeDatabase()` in its `beforeEach` so tests stay
 * independent.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../');
const COMPOSE_FILE = resolve(REPO_ROOT, 'docker-compose.test.yml');

interface BootedStack {
  /** Postgres connection string suitable for DATABASE_URL. */
  databaseUrl: string;
  /** Redis connection string suitable for REDIS_URL. */
  redisUrl: string;
  /** Idempotent shutdown — called by global teardown. */
  stop(): Promise<void>;
}

let bootedStack: BootedStack | null = null;

/**
 * Boot a Postgres + Redis pair for the test run. Idempotent — the
 * second caller gets the same handle.
 *
 * Priority order:
 *   1. `@testcontainers/postgresql` + `@testcontainers/redis` (random
 *      ports, parallel-safe, automatic teardown).
 *   2. The committed `docker-compose.test.yml` stack (fixed ports
 *      5433 / 6380, single-worker).
 *
 * Neither available → throw. We refuse to fake-pass integration tests
 * against an in-memory mock — that's what the unit tests are for.
 */
export async function bootIntegrationStack(): Promise<BootedStack> {
  if (bootedStack) return bootedStack;

  // 1. Try testcontainers — peers are optional, only present when the
  //    developer has run `pnpm add -D @testcontainers/postgresql
  //    @testcontainers/redis` at root.
  const viaTestcontainers = await tryTestcontainers();
  if (viaTestcontainers) {
    bootedStack = viaTestcontainers;
    return bootedStack;
  }

  // 2. Fall back to docker compose.
  if (!existsSync(COMPOSE_FILE)) {
    throw new Error(
      `Integration stack unavailable: testcontainers not installed AND ${COMPOSE_FILE} is missing. ` +
        `Install testcontainers (\`pnpm add -D @testcontainers/postgresql @testcontainers/redis\`) ` +
        `OR ensure docker-compose.test.yml exists at the repo root.`,
    );
  }
  const viaCompose = await bootViaCompose();
  bootedStack = viaCompose;
  return bootedStack;
}

async function tryTestcontainers(): Promise<BootedStack | null> {
  // Use dynamic imports inside try/catch so a missing peer dependency
  // falls through to the docker-compose path rather than crashing the
  // entire suite.
  let PostgreSqlContainer: typeof import('@testcontainers/postgresql').PostgreSqlContainer;
  let RedisContainer: typeof import('@testcontainers/redis').RedisContainer;
  try {
    ({ PostgreSqlContainer } = await import('@testcontainers/postgresql'));
    ({ RedisContainer } = await import('@testcontainers/redis'));
  } catch {
    return null;
  }

  const pg = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('eazepay_test')
    .withUsername('eazepay')
    .withPassword('eazepay')
    // tmpfs the data dir so the suite is fast and leaves no trace.
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .withCommand([
      'postgres',
      '-c',
      'fsync=off',
      '-c',
      'synchronous_commit=off',
      '-c',
      'full_page_writes=off',
    ])
    .start();
  const redis = await new RedisContainer('redis:7-alpine').withTmpFs({ '/data': 'rw' }).start();

  const databaseUrl = pg.getConnectionUri();
  const redisUrl = redis.getConnectionUrl();

  await runPrismaMigrateDeploy(databaseUrl);

  return {
    databaseUrl,
    redisUrl,
    async stop(): Promise<void> {
      await Promise.allSettled([pg.stop(), redis.stop()]);
    },
  };
}

async function bootViaCompose(): Promise<BootedStack> {
  // `--wait` blocks until every service reports healthy. With our
  // tight health-check intervals (2 s) the typical wait is 5-10 s.
  const up = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  failIfErrored(up, 'docker compose up');

  const databaseUrl = 'postgresql://eazepay:eazepay@localhost:5433/eazepay_test';
  const redisUrl = 'redis://localhost:6380';

  await runPrismaMigrateDeploy(databaseUrl);

  return {
    databaseUrl,
    redisUrl,
    async stop(): Promise<void> {
      // `down -v` removes the named volumes too — irrelevant here since
      // both services are tmpfs-backed, but cheap and consistent.
      spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'down', '-v'], {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      });
    },
  };
}

async function runPrismaMigrateDeploy(databaseUrl: string): Promise<void> {
  // Run from apps/api so prisma picks up the right schema.prisma. We
  // execute via `pnpm exec prisma` so the workspace's pinned Prisma
  // version is used (avoids drift between dev tooling and migrations).
  const apiDir = resolve(REPO_ROOT, 'apps/api');
  const r = spawnSync(
    'pnpm',
    ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    {
      cwd: apiDir,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );
  failIfErrored(r, 'prisma migrate deploy');
}

function failIfErrored(r: SpawnSyncReturns<string>, label: string): void {
  if (r.error) {
    throw new Error(`${label} failed to spawn: ${r.error.message}`);
  }
  if (typeof r.status === 'number' && r.status !== 0) {
    throw new Error(
      `${label} exited ${r.status}\n` + `stdout: ${r.stdout ?? ''}\n` + `stderr: ${r.stderr ?? ''}`,
    );
  }
}

/**
 * TRUNCATE every user-managed table in dependency order. Faster than
 * dropping + re-migrating between tests; safe because we're on tmpfs
 * and our schema doesn't ship circular FKs that would block this.
 *
 * Lazily imports `@prisma/client` so this module can be required from
 * specs that haven't yet generated the Prisma client (e.g. in CI bootstrap).
 */
export async function wipeDatabase(databaseUrl: string): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    // `_prisma_migrations` is excluded so we don't wipe schema history
    // and force a re-deploy on every test.
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename <> '_prisma_migrations'
    `;
    if (rows.length === 0) return;
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    // CASCADE clears dependent FKs in one statement; RESTART IDENTITY
    // resets serial counters so test IDs don't drift across runs.
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Convenience: minimum env vars the NestJS AppModule needs to boot in
 * test mode. Specs call this then pass the booted-stack URLs through.
 */
export function applyTestEnv(databaseUrl: string, redisUrl: string): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  // 32 bytes of zeros — fine for tests, refused by the prod superRefine.
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? 'test-jwt-secret-min-32-chars-long-xxx';
  process.env.LOCAL_KEK_HEX =
    process.env.LOCAL_KEK_HEX ?? '0000000000000000000000000000000000000000000000000000000000000000';
  process.env.AUTH_PROVIDER = 'local';
  process.env.NODE_ENV = 'development'; // ConsoleNotificationAdapter requires this; bootstrap reads NODE_ENV.
  // Disable every cron — we don't want background work racing tests.
  process.env.CRON_LEADER = 'false';
  process.env.WEBHOOK_DISPATCHER_ENABLED = 'false';
  process.env.AUDIT_DRAIN_ENABLED = 'false';
  process.env.COLLECTION_CRON_ENABLED = 'false';
  // Local-fs object storage avoids needing an S3 mock.
  process.env.OBJECT_STORAGE = 'local-fs';
}

/**
 * Boots the real NestJS AppModule against the test stack and returns
 * the Fastify HTTP adapter so specs can use `inject()` for in-process
 * HTTP round-trips. No real port is bound — `inject` calls Fastify
 * directly, which is faster and immune to ephemeral-port collisions.
 *
 * `overrides` lets a spec swap any provider (e.g. NOTIFICATION_GATEWAY
 * for an OTP-capturing stub). The override array follows the standard
 * Nest testing-module shape.
 */
export async function createTestingApp(
  databaseUrl: string,
  redisUrl: string,
  overrides: Array<{ token: unknown; useValue: unknown }> = [],
): Promise<{
  app: import('@nestjs/platform-fastify').NestFastifyApplication;
  close: () => Promise<void>;
}> {
  applyTestEnv(databaseUrl, redisUrl);

  const { Test } = await import('@nestjs/testing');
  // FastifyAdapter is the runtime value; NestFastifyApplication is a
  // type-only re-export. Destructuring `type X` inside a dynamic import
  // isn't valid syntax, so the type is captured via a separate
  // `import type` at the top of the file (via the return-type
  // annotation above) and we only pull the value here.
  const { FastifyAdapter } = await import('@nestjs/platform-fastify');
  const { ValidationPipe } = await import('@nestjs/common');
  // SEC-117: mirror the production pipe stack from apps/api/src/main.ts.
  // Without ZodValidationPipe the tests pass on input that production
  // would reject — divergence between test posture and prod is exactly
  // the kind of gap a security audit catches at the worst time.
  const { ZodValidationPipe } = await import('nestjs-zod');
  const { AppModule } = await import('../../src/app/app.module.js');
  type NestFastifyApplication = import('@nestjs/platform-fastify').NestFastifyApplication;

  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const o of overrides) {
    builder = builder.overrideProvider(o.token as never).useValue(o.useValue);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ bodyLimit: 1024 * 1024 }),
    { bufferLogs: true, rawBody: true },
  );
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ZodValidationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  // Fastify needs `.ready()` for inject() to work cleanly.
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    close: async (): Promise<void> => {
      await app.close();
    },
  };
}

/** Stop the booted stack — invoked from a global teardown hook. */
export async function teardownIntegrationStack(): Promise<void> {
  if (bootedStack) {
    await bootedStack.stop();
    bootedStack = null;
  }
}
