import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { Unauthorized } from '@eazepay/shared-utils';
import { TokenService } from '../internal/token.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { PRISMA } from '../internal/tokens.js';
import type { SessionContext } from '../auth.types.js';

/**
 * Verifies the access JWT and attaches `req.user` (SessionContext).
 * Routes opt out via @Public(). Apply globally via APP_GUARD.
 *
 * SEC-009 — session-revocation enforcement.
 *
 * Access JWTs have a 15-minute TTL. Until this fix, the guard only
 * validated signature + expiry, so a session revoked via logout or
 * admin disable kept working until natural expiry — a 15-minute
 * window where a compromised or fired admin could keep making
 * requests with a stolen token. We now look up the Session row by
 * the `sid` claim (Session.id) and reject if `revokedAt` is set.
 *
 * Worst-case revocation latency = REVOCATION_CACHE_TTL_MS (60s). The
 * cache is per-instance, in-memory; with N pods you can see up to
 * 60s of stale "still-valid" decisions per pod. For high-stakes
 * revocations (employee termination, breach response) the operator
 * should also invalidate the refresh token chain via SessionService
 * — that takes effect at the next refresh boundary regardless of
 * this cache. A future iteration can move this to Redis with pub/sub
 * busting so revocations are near-instant across the fleet.
 *
 * Cache miss / DB unavailable: we fail closed (treat as revoked) to
 * avoid giving an attacker a "DB outage = bypass auth" oracle. The
 * verifyAccess step already passed, so we know the token itself is
 * legitimate — we just can't confirm it hasn't been revoked. In a
 * production-grade build this could be relaxed with a circuit-breaker
 * + alert, but fail-closed is the SOC-2 safe default.
 */

/** Worst-case time between a Session.revokedAt write and this guard
 *  observing it. Operator-visible: surfaced in our SLA docs. */
const REVOCATION_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  /** When this verdict expires and must be re-fetched. */
  expiresAt: number;
  /** true = session is live, false = revoked or missing. */
  isLive: boolean;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /** Per-instance cache of session liveness. Keyed by Session.id. We
   *  cache both live and revoked verdicts so a steady stream of
   *  requests on a revoked token doesn't hammer Postgres. */
  private readonly liveness = new Map<string, CacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: SessionContext;
      ip?: string;
    }>();

    const auth = req.headers['authorization'];
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (!header?.startsWith('Bearer ')) {
      throw Unauthorized({ code: 'missing_bearer' });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw Unauthorized({ code: 'missing_bearer' });

    let claims;
    try {
      claims = await this.tokens.verifyAccess(token);
    } catch (err) {
      this.logger.debug({ err }, 'jwt verify failed');
      throw Unauthorized({ code: 'invalid_token' });
    }

    // SEC-009: confirm the backing Session has not been revoked. The
    // JWT carries the session id in the `sid` claim (mapped to
    // Session.id at mint time in TokenService).
    const sessionLive = await this.isSessionLive(claims.sid);
    if (!sessionLive) {
      throw Unauthorized({ code: 'session_revoked' });
    }

    req.user = {
      userId: claims.sub,
      sessionId: claims.sid,
      ipAddress: req.ip,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? undefined,
    };
    return true;
  }

  /**
   * Look up Session liveness, with a short-lived in-memory cache.
   *
   * "Live" means: the session row exists AND `revokedAt` is null. A
   * deleted session is treated as revoked (fail-closed). DB errors
   * also fail closed — see class-level comment.
   *
   * The cache TTL is intentionally short (60s) so a revocation by a
   * concurrent request (e.g. team.update() flipping status=disabled
   * and calling session.updateMany) propagates quickly. Tune via
   * REVOCATION_CACHE_TTL_MS.
   */
  private async isSessionLive(sessionId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.liveness.get(sessionId);
    if (cached && cached.expiresAt > now) {
      return cached.isLive;
    }

    let isLive: boolean;
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { revokedAt: true, expiresAt: true },
      });
      // Session missing => revoked-or-rotated. Expired refresh window
      // also implies the access token shouldn't outlive its session,
      // even though the JWT exp check passed. (The refresh-token
      // lifetime is the outer bound on a session's existence.)
      isLive =
        session !== null &&
        session.revokedAt === null &&
        session.expiresAt.getTime() > now;
    } catch (err) {
      // Fail closed — see class-level comment. Log loudly so we can
      // see DB-availability incidents in dashboards.
      this.logger.error({ err, sessionId }, 'session liveness lookup failed');
      isLive = false;
    }

    // Opportunistic cache cleanup so the Map doesn't grow unbounded
    // on long-lived pods. Cheap: amortised O(1) per request.
    if (this.liveness.size > 1024) {
      for (const [key, entry] of this.liveness) {
        if (entry.expiresAt <= now) this.liveness.delete(key);
      }
    }

    this.liveness.set(sessionId, {
      isLive,
      expiresAt: now + REVOCATION_CACHE_TTL_MS,
    });
    return isLive;
  }
}
