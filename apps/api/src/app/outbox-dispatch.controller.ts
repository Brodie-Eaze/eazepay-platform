import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Optional,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Public } from '@eazepay/service-auth';
import { BadRequest, Unauthorized } from '@eazepay/shared-utils';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { WEBHOOK_PUBLISHER, type WebhookPublisher } from '@eazepay/service-webhook';
import type { OutboxKind } from '@eazepay/shared-types';

/**
 * Internal outbox-dispatch bridge.
 *
 * WHY THIS EXISTS
 * ---------------
 * The transactional outbox is INSERTed by both Drizzle (partner-portal
 * BFF) and Prisma (NestJS services, e.g. services/payment). The drain
 * worker lives in the partner-portal Node process — it can't directly
 * call into the NestJS DI container (NotificationService /
 * WebhookService) because those run in apps/api, a separate process.
 *
 * The handler registry in `apps/partner-portal/lib/workers/outbox-drain.ts`
 * therefore POSTs each pending row to this controller. The controller
 * authenticates the caller via a constant-time-compared shared secret
 * (`INTERNAL_OUTBOX_DISPATCH_SECRET`), dispatches to the right Nest
 * service via the existing `NotifyPort` / `WebhookPublisher` injection
 * tokens, and translates the result back to the drain worker's
 * `{ ok: true } | { ok: false, error }` contract.
 *
 * SECURITY POSTURE
 * ----------------
 *   • Public route (no JWT). The drain worker has no user session;
 *     authn is the shared secret. The secret is supplied via an
 *     `x-eazepay-internal-secret` header.
 *   • Constant-time compare. The header is compared byte-for-byte via
 *     `timingSafeEqual` so a network-adjacent attacker can't probe the
 *     secret with a timing oracle.
 *   • Refuses to mount when the secret is unset OR shorter than 32
 *     bytes. Returning 401 on every request is the only safe behaviour
 *     for an internal-only auth surface that lost its credential.
 *   • This route MUST never be exposed publicly. apps/api today fronts
 *     all routes behind the same edge — operators must deny external
 *     ingress to `/v1/_internal/*` at the reverse-proxy / Railway
 *     ingress layer (same posture as the existing `/admin/*` surface).
 *
 * IDEMPOTENCY
 * -----------
 * The drain worker delivers at-least-once. Handlers downstream
 * (NotificationService.notify, WebhookService.publish) already collapse
 * duplicates: notifications via the (subjectType, subjectId, templateKey)
 * key for in_app and webhook via the (endpointId, eventId) unique
 * index. A re-dispatch of the same row is therefore a no-op at the
 * service layer.
 *
 * OBSERVABILITY
 * -------------
 * Every dispatch attempt logs `{ event: 'outbox.dispatch.<result>',
 * kind, durationMs }`. The drain worker carries its own structured
 * log line per row; the two correlate via the `kind` + payload subject
 * fields.
 */

const NotificationPayloadSchema = z.object({
  kind: z.literal('notification.send'),
  userId: z.string().min(1),
  templateKey: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()).optional(),
  subjectType: z.string().min(1).max(64).optional(),
  subjectId: z.string().min(1).max(128).optional(),
});

const WebhookPayloadSchema = z.object({
  kind: z.literal('webhook.outbound'),
  eventType: z.string().min(1).max(100),
  eventId: z.string().min(1).max(200),
  subjectType: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(128),
  // merchantId can be null in the wire schema but the Prisma-side
  // enqueue helper already drops merchant-less webhooks before they
  // hit the outbox, so a null here is a deploy bug — reject with 400.
  merchantId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});

const DispatchBodySchema = z.object({
  // Discriminator. The body's `payload.kind` must match — the helper
  // in services/payment writes both fields, which is intentional
  // belt-and-braces: tampering with one without the other lands on
  // the parse step here.
  kind: z.enum(['notification.send', 'webhook.outbound']),
  payload: z.record(z.string(), z.unknown()),
});

/** Minimum bytes for the shared secret. Mirrors DEMO_COOKIE_SECRET
 *  posture in partner-portal — 32 chars = 256 bits of entropy. */
const MIN_SECRET_BYTES = 32;

/**
 * Body returned to the drain worker.
 *
 * `ok: true`  → marks the outbox row `sent`.
 * `ok: false` → marks the row `failed` and schedules a retry; after
 *               MAX_ATTEMPTS the row goes `dead`.
 *
 * The shape mirrors `OutboxHandlerResult` in outbox-drain.ts so the
 * drain worker doesn't need a per-handler translator.
 */
interface DispatchResult {
  ok: boolean;
  error?: string;
}

@ApiTags('internal')
@Public()
@Controller('_internal/outbox')
export class OutboxDispatchController {
  private readonly logger = new Logger(OutboxDispatchController.name);

  constructor(
    // NotifyPort + WebhookPublisher are provided by NotificationModule
    // + WebhookModule (both marked `global: true`). Optional so a
    // mis-wired module doesn't crash the bootstrap; we surface the
    // condition as a 503 at dispatch time.
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
    @Optional() @Inject(WEBHOOK_PUBLISHER) private readonly webhooks?: WebhookPublisher,
  ) {}

  @Post('dispatch')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Internal: dispatch an outbox row. Caller is the partner-portal drain worker; auth is a shared secret.',
  })
  async dispatch(
    @Headers('x-eazepay-internal-secret') secret: string | undefined,
    @Body() body: unknown,
  ): Promise<DispatchResult> {
    this.assertSecret(secret);

    // Discriminator parse — narrow the body before we hand it to a
    // per-kind handler. zod.safeParse so we can return the structured
    // error to the drain (which logs it onto the row's last_error).
    const outer = DispatchBodySchema.safeParse(body);
    if (!outer.success) {
      throw BadRequest({
        code: 'invalid_dispatch_body',
        detail: outer.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      });
    }
    const kind: OutboxKind = outer.data.kind;

    const start = Date.now();
    try {
      const result = await this.dispatchByKind(kind, outer.data.payload);
      this.logger.log(
        {
          event: result.ok ? 'outbox.dispatch.sent' : 'outbox.dispatch.failed',
          kind,
          durationMs: Date.now() - start,
          ...(result.error ? { error: result.error } : {}),
        },
        result.ok ? 'outbox dispatch sent' : 'outbox dispatch failed',
      );
      return result;
    } catch (err) {
      // Unexpected throw — translate to {ok:false} so the drain
      // treats it as a transient failure and retries. Persistent
      // failures hit MAX_ATTEMPTS and land on the DLQ tile.
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(
        {
          event: 'outbox.dispatch.threw',
          kind,
          durationMs: Date.now() - start,
          err: reason,
        },
        'outbox dispatch threw',
      );
      return { ok: false, error: reason };
    }
  }

  private async dispatchByKind(
    kind: OutboxKind,
    payload: Record<string, unknown>,
  ): Promise<DispatchResult> {
    switch (kind) {
      case 'notification.send': {
        if (!this.notify) {
          return { ok: false, error: 'notify_port_unavailable' };
        }
        const parsed = NotificationPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return {
            ok: false,
            error: `invalid_notification_payload:${parsed.error.errors[0]?.message ?? 'unknown'}`,
          };
        }
        await this.notify.notify({
          userId: parsed.data.userId,
          templateKey: parsed.data.templateKey,
          ...(parsed.data.payload !== undefined ? { payload: parsed.data.payload } : {}),
          ...(parsed.data.subjectType !== undefined
            ? { subjectType: parsed.data.subjectType }
            : {}),
          ...(parsed.data.subjectId !== undefined ? { subjectId: parsed.data.subjectId } : {}),
        });
        return { ok: true };
      }
      case 'webhook.outbound': {
        if (!this.webhooks) {
          return { ok: false, error: 'webhook_publisher_unavailable' };
        }
        const parsed = WebhookPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return {
            ok: false,
            error: `invalid_webhook_payload:${parsed.error.errors[0]?.message ?? 'unknown'}`,
          };
        }
        await this.webhooks.publish({
          eventType: parsed.data.eventType,
          eventId: parsed.data.eventId,
          subjectType: parsed.data.subjectType,
          subjectId: parsed.data.subjectId,
          merchantId: parsed.data.merchantId,
          payload: parsed.data.payload,
        });
        return { ok: true };
      }
      case 'audit.log':
        // The audit-log outbox is owned by services/audit's
        // AuditDrainService, which reads `auditOutbox` directly. The
        // generic outbox_events row is therefore a no-op from this
        // controller's perspective; ack it so the drain marks it sent.
        return { ok: true };
      default: {
        // Exhaustiveness — TypeScript flags new OutboxKind variants
        // here at compile time so a missing case is caught in CI.
        const _exhaustive: never = kind;
        return { ok: false, error: `unhandled_kind:${String(_exhaustive)}` };
      }
    }
  }

  /**
   * Constant-time compare against `INTERNAL_OUTBOX_DISPATCH_SECRET`.
   * Refuses every request when the env var is unset OR shorter than
   * MIN_SECRET_BYTES — the only safe posture for an internal-only
   * auth surface that lost its credential.
   *
   * Returns 401 with a stable code so the drain worker's retry path
   * can distinguish auth-failure from handler-failure (auth-failure
   * is terminal; no point in retrying a wrong secret).
   */
  private assertSecret(supplied: string | undefined): void {
    const expected = process.env['INTERNAL_OUTBOX_DISPATCH_SECRET'];
    if (!expected || expected.length < MIN_SECRET_BYTES) {
      // Log loudly so an operator sees the misconfiguration in the
      // first drain tick rather than chasing a wave of 401s.
      this.logger.error(
        {
          event: 'outbox.dispatch.secret_unconfigured',
          minBytes: MIN_SECRET_BYTES,
        },
        'INTERNAL_OUTBOX_DISPATCH_SECRET is unset or too short — refusing all dispatch calls',
      );
      throw Unauthorized({ code: 'internal_secret_unconfigured' });
    }
    if (!supplied) {
      throw Unauthorized({ code: 'missing_internal_secret' });
    }
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw Unauthorized({ code: 'invalid_internal_secret' });
    }
  }
}
