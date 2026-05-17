import { Controller, Get, Headers, Logger, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard, AdminOnly } from '@eazepay/service-auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EventsService } from './events.service.js';
import type { EventsSubscriber } from './events.subscriber.js';
import { startSse } from './internal/sse-writer.js';

/**
 * Master fleet event stream — admin-only SSE endpoint that emits
 * EVERY event in the system.
 *
 * Hardening:
 *   - JWT + AdminGuard (operator-only).
 *   - Throttled to 6 connections per IP per minute (a fresh connect
 *     is a privileged action; reconnect storms beyond that are
 *     either a buggy client or hostile and should fail fast).
 *   - 60s heartbeat comment frame so idle proxies don't kill the
 *     connection; client uses it as a liveness probe.
 *   - Last-Event-ID replay capped at 500 rows so a malicious client
 *     can't request the entire log in one round-trip.
 *   - Per-connection backpressure: if `res.write` ever returns false
 *     (kernel buffer full because the client is slow), we drop the
 *     event and emit a "lost" comment so the client knows to refresh.
 *   - Listener handler is wrapped — a thrown error in the controller
 *     never propagates back into the EventsSubscriber loop.
 */
@ApiTags('events')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AdminGuard)
@Controller('events')
export class EventStreamController {
  private readonly log = new Logger(EventStreamController.name);

  constructor(
    private readonly events: EventsService,
    private readonly subscriber: EventsSubscriber,
  ) {}

  @Get('stream')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({
    summary: 'SSE stream of every event in the system (admin only). Supports Last-Event-ID replay.',
  })
  async stream(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<void> {
    const sse = startSse(res, { disableBuffering: true });

    // Replay the catchup window first so the client never misses
    // events that landed between disconnect and reconnect.
    if (lastEventId) {
      const since = parseLastEventId(lastEventId);
      if (since !== null) {
        try {
          const missed = await this.events.listSince(since, {
            merchantId: null,
            master: true,
          });
          for (const m of missed) sse.send(m);
        } catch (e) {
          this.log.warn(
            `master stream catchup failed for Last-Event-ID=${lastEventId}`,
            e instanceof Error ? e.stack : e,
          );
          sse.comment(`catchup-failed`);
        }
      }
    }

    sse.comment('connected');

    // Live subscription. Listener handler must not throw — wrapped.
    const unsubscribe = this.subscriber.on((event) => {
      try {
        sse.send(event);
      } catch (e) {
        this.log.warn(
          `master stream write failed for event ${event.uuid}`,
          e instanceof Error ? e.stack : e,
        );
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
  // Wire format is the BigInt id as a decimal string. Reject anything
  // else (e.g. UUID) so we can't be tricked into a malformed query.
  if (!/^\d{1,20}$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
