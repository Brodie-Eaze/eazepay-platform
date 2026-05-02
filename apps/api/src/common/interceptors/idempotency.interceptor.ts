import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Conflict, BadRequest, stableJsonSha256, IDEMPOTENT_KEY } from '@eazepay/shared-utils';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service.js';

interface CachedResponse {
  status: number;
  body: unknown;
  fingerprint: string;
}

const TTL_SECONDS = 24 * 60 * 60;
const KEY_HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return next.handle();

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method: string;
      url: string;
      body: unknown;
      user?: { sub?: string };
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

    const fingerprint = stableJsonSha256({
      method: req.method,
      url: req.url,
      body: req.body ?? null,
      sub: req.user?.sub ?? null,
    });

    const redisKey = `idemp:${key}`;
    return this.handle(redisKey, fingerprint, next, context);
  }

  private handle(
    redisKey: string,
    fingerprint: string,
    next: CallHandler,
    context: ExecutionContext,
  ): Observable<unknown> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          const existing = await this.redis.client.get(redisKey);
          if (existing) {
            const cached = JSON.parse(existing) as CachedResponse;
            if (cached.fingerprint !== fingerprint) {
              subscriber.error(
                Conflict({
                  code: 'idempotency_key_mismatch',
                  detail:
                    'The same Idempotency-Key was used with a different request body.',
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

          next
            .handle()
            .pipe(
              tap({
                next: (body) => {
                  const res = context
                    .switchToHttp()
                    .getResponse<{ statusCode: number }>();
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
                },
                error: () => {
                  // Don't cache errors — let the client retry.
                  void this.redis.client.del(redisKey);
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
