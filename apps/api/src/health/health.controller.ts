import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@eazepay/service-auth';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';

/**
 * Health endpoints — split into two distinct contracts.
 *
 *   GET /v1/health/live   — Liveness probe (am I alive?). Returns 200
 *                           as soon as the Node process is up and the
 *                           HTTP listener is bound. Never touches a
 *                           dependency. Used by orchestrators to decide
 *                           "should I restart this pod?". If this 5xx's
 *                           Railway / k8s will respawn the container.
 *
 *   GET /v1/health/ready  — Readiness probe (can I serve traffic?).
 *                           Pings the database AND Redis with a 2-second
 *                           timeout each. Returns 200 only when BOTH are
 *                           healthy. Used by load balancers / Railway's
 *                           healthcheck to decide whether to route a
 *                           request to this replica. A 503 here makes
 *                           Railway pull the pod out of rotation without
 *                           killing it, which is what we want during
 *                           transient Redis blips or DB failovers.
 *
 * Probe deployment expectations:
 *   • railway.api.toml (the API service) currently points at
 *     `healthcheckPath = "/v1/health/live"`. That is the right value
 *     for boot-time readiness — Railway needs *some* successful response
 *     to start routing traffic to a fresh deploy, and `/v1/health/ready`
 *     would fail before Prisma's onModuleInit completes. The recommended
 *     production setup is to flip railway.api.toml to
 *     `healthcheckPath = "/v1/health/ready"` once the deploy is stable;
 *     that gives the load balancer accurate dependency-aware health.
 *   • railway.toml (the partner-portal service, NOT the API) points at
 *     `/sign-in` — that is correct for partner-portal because it's a
 *     Next.js app with no shared health surface; `/sign-in` is its
 *     cheapest 200. Do not confuse the two services.
 *
 * Auth posture: the controller is @Public() because the healthchecker
 * is an unauthenticated probe — Railway's container-network agent does
 * not carry a bearer token, and adding auth here would defeat the probe.
 * Both endpoints reveal only health state, no PII.
 */
const PROBE_TIMEOUT_MS = 2000;

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe — am I alive? Returns 200 as long as the process is running.',
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe — can I serve traffic? Returns 200 only when DB + Redis are healthy.',
  })
  async ready(): Promise<{
    status: 'ok';
    checks: { db: 'ok'; redis: 'ok' };
  }> {
    // Run both probes in parallel; each is wrapped in its own 2-second
    // timeout so a single slow dependency does not blow the whole probe
    // budget. We collect results independently to give the caller a
    // precise picture (which dependency failed) on degradation.
    const [dbResult, redisResult] = await Promise.all([this.probeDb(), this.probeRedis()]);

    if (dbResult === 'ok' && redisResult === 'ok') {
      return { status: 'ok', checks: { db: 'ok', redis: 'ok' } };
    }

    const errors: string[] = [];
    if (dbResult !== 'ok') errors.push(`db: ${dbResult}`);
    if (redisResult !== 'ok') errors.push(`redis: ${redisResult}`);
    const error = errors.join('; ');
    this.logger.warn(`Readiness probe failed — ${error}`);

    // 503 Service Unavailable — Railway / load balancer should pull this
    // replica out of rotation. The error payload is intentionally terse
    // (no stack traces, no connection strings) so a probe that hits a
    // logging sink does not leak infrastructure detail.
    throw new ServiceUnavailableException({
      status: 'degraded',
      checks: {
        db: dbResult === 'ok' ? 'ok' : 'fail',
        redis: redisResult === 'ok' ? 'ok' : 'fail',
      },
      error,
    });
  }

  /**
   * Run a Postgres SELECT 1 against the Prisma client with a 2-second
   * timeout. Returns 'ok' on success, or a short error string suitable
   * for log + response surface. Never throws — failures collapse into a
   * sentinel string so the caller's logic stays linear.
   */
  private async probeDb(): Promise<'ok' | string> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('db_timeout')), PROBE_TIMEOUT_MS),
        ),
      ]);
      return 'ok';
    } catch (err) {
      return err instanceof Error ? err.message : 'db_unknown_error';
    }
  }

  /**
   * Run an ioredis PING against the Redis client with a 2-second
   * timeout. Returns 'ok' on PONG, or a short error string. Same
   * non-throwing contract as probeDb.
   */
  private async probeRedis(): Promise<'ok' | string> {
    try {
      const result = await Promise.race([
        this.redis.client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('redis_timeout')), PROBE_TIMEOUT_MS),
        ),
      ]);
      return result === 'PONG' ? 'ok' : `redis_unexpected_reply:${result}`;
    } catch (err) {
      return err instanceof Error ? err.message : 'redis_unknown_error';
    }
  }
}
