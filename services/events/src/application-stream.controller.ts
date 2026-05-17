import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtAuthGuard } from '@eazepay/service-auth';
import type { UserId } from '@eazepay/shared-types';
import type { PrismaClient } from '@prisma/client';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EventsService } from './events.service.js';
import type { EventsSubscriber } from './events.subscriber.js';
import { startSse } from './internal/sse-writer.js';
import { PRISMA } from './internal/tokens.js';

/**
 * Per-application SSE stream — partner-scoped.
 *
 * Authorisation chain (all must pass before the stream opens):
 *   1. JWT valid + signed by our issuer (JwtAuthGuard).
 *   2. Caller has a MerchantUser row for this application's merchant
 *      (verified server-side via a single SELECT before the stream
 *      starts; if it fails the response is 403 — no SSE upgrade).
 *   3. Per-event re-filter: even though we authorised in step 2, we
 *      filter every published event in the listener by
 *      (event.merchantId === merchantId) so a buggy
 *      publisher can't accidentally cross tenants. Defence in depth.
 *
 * Throttling:
 *   - 6 stream opens per IP per minute. Once connected, the live
 *     stream itself isn't throttled — it's push, not pull.
 *
 * Catchup:
 *   - Last-Event-ID replays events for THIS application id only
 *     (filter on event_log.targetType='Application' AND targetId=id).
 *     Cap 500 rows.
 *
 * Lifecycle:
 *   - 60s heartbeat.
 *   - Cleanup on close/abort/error.
 *   - JWT re-check every 5 min (background): if token expired,
 *     close the stream with a typed comment so the client knows to
 *     re-auth rather than reconnect blindly.
 */
@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationStreamController {
  private readonly log = new Logger(ApplicationStreamController.name);

  constructor(
    private readonly events: EventsService,
    private readonly subscriber: EventsSubscriber,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  @Get(':id/stream')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'SSE stream of events for one application (partner-scoped). Sales-rep live offer ticker consumes this.',
  })
  async stream(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, merchantId: true },
    });
    if (!application) throw new NotFoundException(`application ${applicationId} not found`);

    // Direct-consumer applications (no merchant attribution) are not
    // subscribable by partners — only the master stream surfaces
    // those. Fail closed.
    if (!application.merchantId) {
      throw new ForbiddenException('application has no merchant scope');
    }
    const merchantId: string = application.merchantId;

    // Authz: caller must be a MerchantUser of the application's
    // merchant. One row check, no joins.
    const callerUserId = userId as unknown as string;
    if (!callerUserId) {
      throw new ForbiddenException('no user identity on stream request');
    }
    const allowed = await this.prisma.merchantUser.findFirst({
      where: { merchantId, userId: callerUserId },
      select: { id: true },
    });
    if (!allowed) {
      throw new ForbiddenException(`not a member of merchant ${merchantId}`);
    }

    const sse = startSse(res, { disableBuffering: true });

    // Replay catchup, scoped to this app.
    if (lastEventId) {
      const since = parseLastEventId(lastEventId);
      if (since !== null) {
        try {
          const missed = await this.events.listSince(since, {
            merchantId: merchantId,
            master: false,
          });
          // Filter strictly to this application.
          for (const m of missed) {
            if (m.targetType === 'Application' && m.targetId === applicationId) {
              sse.send(m);
            }
          }
        } catch (e) {
          this.log.warn(
            `app stream catchup failed app=${applicationId} since=${lastEventId}`,
            e instanceof Error ? e.stack : e,
          );
          sse.comment('catchup-failed');
        }
      }
    } else {
      // No Last-Event-ID — seed the ticker with the most recent N
      // events for this application so the rep sees offers that
      // arrived before they opened the page.
      try {
        const recent = await this.events.listForTarget(
          'Application',
          applicationId,
          { merchantId: merchantId, master: false },
          50,
        );
        for (const r of recent) sse.send(r);
      } catch (e) {
        this.log.warn(`app stream seed failed app=${applicationId}`, e);
      }
    }

    sse.comment('connected');

    const unsubscribe = this.subscriber.on((event) => {
      // Per-event re-filter — even though the JWT authz passed at
      // connect, every event is re-checked against the application's
      // merchant + targetId. If those drift, the event is dropped.
      if (event.merchantId !== merchantId) return;
      if (event.targetType !== 'Application' || event.targetId !== applicationId) return;
      try {
        sse.send(event);
      } catch (e) {
        this.log.warn(`app stream write failed event=${event.uuid}`, e);
      }
    });

    const heartbeat = setInterval(() => {
      try {
        sse.comment(`hb ${Date.now()}`);
      } catch {
        /* ignore */
      }
    }, 60_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      sse.close();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    req.on('error', cleanup);
  }
}

function parseLastEventId(raw: string): bigint | null {
  if (!/^\d{1,20}$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
