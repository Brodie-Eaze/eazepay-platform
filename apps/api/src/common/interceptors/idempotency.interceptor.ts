import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Conflict, BadRequest, stableJsonSha256, IDEMPOTENT_KEY } from '@eazepay/shared-utils';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { RedisService } from '../../redis/redis.service.js';

interface CachedResponse {
  status: number;
  body: unknown;
  fingerprint: string;
}

const TTL_SECONDS = 24 * 60 * 60;
const KEY_HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

// SEC-049 — per-user in-flight idempotency key cap.
//
// Threat: pre-fix, there was no limit on how many unique
// Idempotency-Key values a single user could hold concurrently. Each
// reserved key sat in Redis for TTL_SECONDS (24h) regardless of
// whether the request completed. An attacker (or a compromised mobile
// client looping on errors) could fire thousands of unique keys to
// fill Redis, evict other tenants' idempotency cache, and incur memory
// bills proportional to their attack effort. The Stripe-style
// 24h-TTL is correct; what was missing was a per-user concurrency cap.
//
// Fix: maintain a Redis Set per user listing active keys. Add the new
// key to the set on reservation, remove on cache (response done) or
// error (don't cache errors). Before accepting a new key, count the
// set; reject with 429 if at the cap. The set itself has a 24h
// expiry mirroring TTL_SECONDS so abandoned tracking eventually
// reaps even if SREM is missed on a crash.
const MAX_INFLIGHT_PER_USER = 100;
const INFLIGHT_KEY_PREFIX = 'idemp:active:';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return next.handle();

    // SEC-014 — bind the cached response to the authenticated user.
    //
    // Threat: pre-fix, the fingerprint hashed `req.user?.sub`. But the
    // JwtAuthGuard puts the user id on `req.user.userId`, NOT `.sub`,
    // so the sub-field was always undefined → every entry in Redis was
    // keyed only by `idemp:<key>` with a userless fingerprint. An
    // attacker who guessed (or harvested from a log) another user's
    // Idempotency-Key would receive that user's cached response body
    // (e.g. their decline reason, their bank-account verification
    // result, etc.) — a cross-tenant data leak with no exploit gadget
    // required.
    //
    // Fix: read the actual userId set by JwtAuthGuard, namespace the
    // Redis key with it, and include it in the fingerprint hash. For
    // routes that ARE legitimately public (e.g. webhook handlers that
    // also opt in to @Idempotent()), fall back to a literal 'anon' so
    // anonymous callers still get key-collision behaviour scoped
    // outside any user's bucket.
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method: string;
      url: string;
      body: unknown;
      // Fastify exposes the matched route template here. When present,
      // `/admin/applications/abc` and `/admin/applications/def` both
      // collapse to `/admin/applications/:id` for fingerprinting, which
      // is what we want — the params are already in the body or the
      // Redis key, not the URL.
      routerPath?: string;
      user?: { userId?: string };
    }>();

    const rawKey = req.headers[KEY_HEADER];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key) {
      throw BadRequest({
        code: 'idempotency_key_required',
        detail: `${KEY_HEADER} header is required for this endpoint.`,
      });
    }
    if (!KEY_PATTERN.test(key)) {
      throw BadRequest({
        code: 'idempotency_key_invalid',
        detail: `${KEY_HEADER} must match ${KEY_PATTERN}`,
      });
    }

    const userId = req.user?.userId ?? 'anon';

    // Canonicalise the URL — strip query params so an attacker can't
    // force a fresh fingerprint by appending `?cachebust=1`. Prefer
    // Fastify's `routerPath` (the matched route template) when
    // available; otherwise fall back to parsing the URL's pathname.
    let canonicalPath: string;
    if (typeof req.routerPath === 'string' && req.routerPath.length > 0) {
      canonicalPath = req.routerPath;
    } else {
      try {
        canonicalPath = new URL(req.url, 'http://x').pathname;
      } catch {
        canonicalPath = req.url;
      }
    }

    const fingerprint = stableJsonSha256({
      method: req.method,
      path: canonicalPath,
      body: req.body ?? null,
      userId,
    });

    // Namespace the Redis key by userId so user A and user B can submit
    // the same Idempotency-Key value (Stripe-style "client-generated,
    // best-effort unique") without colliding — and so a stolen key
    // value can't be replayed across users.
    const redisKey = `idemp:${userId}:${key}`;
    const inflightSetKey = `${INFLIGHT_KEY_PREFIX}${userId}`;
    return this.handle(redisKey, inflightSetKey, fingerprint, next, context);
  }

  private handle(
    redisKey: string,
    inflightSetKey: string,
    fingerprint: string,
    next: CallHandler,
    context: ExecutionContext,
  ): Observable<unknown> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          const existing = await this.redis.client.get(redisKey);
          if (existing) {
            // SEC-049 — cache-hit FAST PATH. The task explicitly calls
            // out "Don't add new round-trips on the cache-hit path." So
            // we intentionally skip the SCARD/SADD dance here — the
            // request is already idempotent-completed and the value is
            // already in the in-flight set (or has already aged out).
            const cached = JSON.parse(existing) as CachedResponse;
            if (cached.fingerprint !== fingerprint) {
              subscriber.error(
                Conflict({
                  code: 'idempotency_key_mismatch',
                  detail: 'The same Idempotency-Key was used with a different request body.',
                }),
              );
              return;
            }
            const res = context.switchToHttp().getResponse<{ status: (n: number) => void }>();
            res.status(cached.status);
            subscriber.next(cached.body);
            subscriber.complete();
            return;
          }

          // SEC-049 — cap concurrent in-flight keys per user. SCARD
          // is O(1) on a Set; we check before reserving to keep
          // attackers from bypassing the cap by racing many requests
          // at the same instant. (Race: two requests pass the SCARD
          // check then both SADD; the cap can transiently exceed
          // MAX_INFLIGHT_PER_USER by a small bounded amount under
          // burst load. That's fine — the cap is a memory bound, not
          // a correctness invariant.)
          const inflightCount = await this.redis.client.scard(inflightSetKey);
          if (inflightCount >= MAX_INFLIGHT_PER_USER) {
            subscriber.error(
              Conflict({
                code: 'idempotency_in_flight_limit_exceeded',
                detail: `At most ${MAX_INFLIGHT_PER_USER} Idempotency-Key values may be in flight per user. Wait for in-flight requests to complete (or 24h TTL to elapse) before issuing more.`,
              }),
            );
            return;
          }

          // Reserve the key with NX so concurrent duplicates of the same
          // request collapse to one execution.
          const reserved = await this.redis.client.set(
            redisKey,
            JSON.stringify({ status: 0, body: null, fingerprint }),
            'EX',
            TTL_SECONDS,
            'NX',
          );
          if (reserved !== 'OK') {
            subscriber.error(
              Conflict({
                code: 'idempotency_in_flight',
                detail: 'A request with this Idempotency-Key is already in flight.',
              }),
            );
            return;
          }
          // SEC-049 — track this key in the per-user in-flight set
          // and refresh the set's TTL so abandoned tracking reaps.
          await this.redis.client.sadd(inflightSetKey, redisKey);
          await this.redis.client.expire(inflightSetKey, TTL_SECONDS);

          next
            .handle()
            .pipe(
              tap({
                next: (body) => {
                  const res = context.switchToHttp().getResponse<{ statusCode: number }>();
                  void this.redis.client.set(
                    redisKey,
                    JSON.stringify({
                      status: res.statusCode,
                      body,
                      fingerprint,
                    }),
                    'EX',
                    TTL_SECONDS,
                  );
                  // SEC-049 — the request has settled. Remove from
                  // the in-flight set so the user's quota frees up
                  // (the cached value remains under its own TTL).
                  void this.redis.client.srem(inflightSetKey, redisKey);
                },
                error: () => {
                  // Don't cache errors — let the client retry.
                  void this.redis.client.del(redisKey);
                  void this.redis.client.srem(inflightSetKey, redisKey);
                },
              }),
            )
            .subscribe(subscriber);
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }
}
