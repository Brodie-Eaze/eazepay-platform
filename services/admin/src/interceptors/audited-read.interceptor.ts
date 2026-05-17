import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PRISMA } from '../internal/tokens.js';
import { AUDITED_READ_KEY, type AuditedReadOptions } from '../decorators/audited-read.decorator.js';

/**
 * SEC-018 — writes an audit row for every successful admin read that
 * the controller method annotated with @AuditedRead(...).
 *
 * Why an interceptor and not a guard:
 *   - Guards run before the handler executes, so they can't see whether
 *     the read succeeded. A failed read (404 / 403 / validation) MUST
 *     NOT emit an audit row — the regulator question is "who saw the
 *     consumer's file?", not "who tried." Emitting on attempt would
 *     pollute the audit chain.
 *   - An interceptor wraps the response Observable; we tap the `next`
 *     event (success) and fire-and-forget the audit write so the
 *     response is never blocked or delayed by the audit write.
 *
 * Why fire-and-forget:
 *   The audit-drain cron picks up the AuditOutbox table downstream; a
 *   transient Postgres blip on this one row should not 5xx the read
 *   itself. Failures are logged at ERROR so they surface in dashboards
 *   without breaking the user-facing flow.
 *
 * Why write to the same `auditOutbox` table the rest of admin.service
 * already uses:
 *   Consistency. The audit-drain cron drains one table; the hash chain
 *   is computed over the union of all rows. If we used a separate
 *   collection for reads, the chain would split and a regulator couldn't
 *   ask "everything that happened to this consumer in time order."
 */
@Injectable()
export class AuditedReadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditedReadInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditedReadOptions | undefined>(
      AUDITED_READ_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{
      params?: Record<string, string>;
      query?: Record<string, unknown>;
      user?: { userId?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    // Snapshot the request context BEFORE the handler runs. If we read
    // it inside `tap` we'd capture whatever state the response cycle
    // left behind, which on Fastify can be stripped/recycled.
    const actorId = req.user?.userId ?? null;
    const targetId = meta.idParam ? (req.params?.[meta.idParam] ?? 'list') : 'list';
    const action = `admin.${meta.targetType}.read`;
    const filter = req.query && Object.keys(req.query).length > 0 ? req.query : null;
    const ipAddress = req.ip ?? null;
    const uaHeader = req.headers?.['user-agent'];
    const userAgent =
      typeof uaHeader === 'string'
        ? uaHeader
        : Array.isArray(uaHeader)
          ? (uaHeader[0] ?? null)
          : null;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget. The audit-drain cron picks this row up;
          // there is no contract that the read response must wait for
          // the audit write to durably commit, and blocking the read
          // on a slow Postgres write would add latency to every page
          // view in the ops console for no benefit.
          void this.prisma.auditOutbox
            .create({
              data: {
                actorType: 'admin',
                actorId,
                action,
                targetType: meta.targetType,
                targetId,
                // `after` captures the filter query so a regulator can
                // see WHAT slice of data the admin viewed, not just
                // that they touched the endpoint. For list reads this
                // is the filter set; for detail reads it's typically
                // empty (the id is on targetId already).
                //
                // Cast through Prisma.InputJsonValue: query params come
                // in as `Record<string, unknown>` from Fastify; at
                // runtime they're always JSON-serialisable strings/
                // arrays, but TS doesn't know that.
                after: filter ? ({ filter } as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                ipAddress,
                userAgent,
              },
            })
            .catch((err) =>
              this.logger.error(
                { err, action, targetId, actorId },
                'audited read row write failed',
              ),
            );
        },
        // Intentionally no `error` branch — failed reads should NOT
        // produce audit rows (see class-level comment).
      }),
    );
  }
}
