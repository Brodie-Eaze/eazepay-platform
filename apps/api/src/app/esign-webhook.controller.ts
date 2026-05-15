import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '@eazepay/service-auth';
import { ApplicationService } from '@eazepay/service-application';
import { NotFound, Unauthorized } from '@eazepay/shared-utils';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';

/**
 * Allowlist for the `:provider` route param (SEC-030). Without this,
 * the param flows directly into `process.env[ESIGN_WEBHOOK_SECRET_${X}]`,
 * letting an attacker probe arbitrary env-var names (or trivially DoS
 * by spamming nonexistent providers). zod-parse the param at the
 * route entry; anything not on the list returns 404 to avoid
 * confirming whether a provider exists.
 */
const ProviderSchema = z.enum(['mock', 'docusign', 'dropbox_sign']);
type ESignProvider = z.infer<typeof ProviderSchema>;

const PayloadSchema = z.object({
  envelopeId: z.string().min(1),
  status: z.enum(['drafted', 'sent', 'signed', 'declined', 'expired', 'voided']),
  /** Provider-side timestamp ISO8601. */
  occurredAt: z.string().datetime().optional(),
});

/**
 * E-sign webhook receiver. Public path — never requires our bearer
 * token. Authenticity comes from a per-provider signature header that
 * MUST verify against a per-endpoint shared secret before any state
 * change. We accept the dev `mock` provider with a wide-open header for
 * local testing; every real provider plugs in its signature scheme
 * here without affecting downstream code.
 *
 * SEC-034 — replay window:
 *   Real providers send their own event-time header (DocuSign uses
 *   the `Timestamp` header inside their JSON envelope; Dropbox Sign
 *   uses `x-hellosign-event-time`). To keep one verifier across
 *   providers, we accept either the provider header OR our canonical
 *   `x-eazepay-timestamp` and reject when |now - ts| > 300 seconds.
 *   The timestamp is mixed into the HMAC input as `<ts>.<rawBody>`
 *   so a captured envelope can't be re-played with a new ts.
 */
@ApiTags('webhooks')
@Public()
@Controller('webhooks/esign')
export class ESignWebhookController {
  private readonly logger = new Logger(ESignWebhookController.name);

  constructor(private readonly applications: ApplicationService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'E-sign provider webhook receiver. Signature-verified per provider. Replay-protected via ±5min timestamp window (SEC-034).',
  })
  async receive(
    @Param('provider') providerParam: string,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-eazepay-timestamp') eazepayTimestamp: string | undefined,
    @Headers('x-hellosign-event-time') hellosignTimestamp: string | undefined,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ ok: true }> {
    // SEC-030: validate against an explicit allowlist BEFORE using the
    // value anywhere — especially before constructing the env-var name
    // for the per-provider HMAC secret. Unknown values are 404, not
    // 401, so we don't leak which providers we support.
    const parsed = ProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw NotFound({ code: 'unknown_esign_provider' });
    }
    const provider: ESignProvider = parsed.data;

    // SEC-034 — pick whichever timestamp header the provider sent.
    // Order of preference: our canonical header (works for any sender
    // including the mock), then provider-specific headers.
    const timestamp = eazepayTimestamp ?? hellosignTimestamp;

    this.verifySignature(provider, signature, timestamp, req.rawBody);

    const payload = PayloadSchema.parse(body);

    if (payload.status !== 'signed') {
      // We only act on `signed` for now. Other statuses (declined / voided
      // / expired) get logged here and will drive Contract status updates
      // + Application cancellation in a later round.
      this.logger.log(
        { provider, envelopeId: payload.envelopeId, status: payload.status },
        'esign webhook received non-terminal-signed status; ignored',
      );
      return { ok: true };
    }

    await this.applications.completeContractSignedByEnvelope(payload.envelopeId);
    return { ok: true };
  }

  private verifySignature(
    provider: ESignProvider,
    signature: string | undefined,
    timestamp: string | undefined,
    rawBody: Buffer | undefined,
  ): void {
    // Mock provider: signature header value MUST equal the literal
    // 'dev-mock' to keep the surface intentional even in local testing.
    // SEC-031: the mock branch is dev-only — must never run in
    // production. Boot-time refusal in env.ts is the primary guard;
    // this is the runtime belt-and-braces in case something starts
    // the API with NODE_ENV unset or sneaks a request through.
    if (provider === 'mock') {
      if (process.env.NODE_ENV === 'production') {
        throw NotFound({ code: 'mock_disabled_in_production' });
      }
      if (signature !== 'dev-mock') {
        throw Unauthorized({ code: 'invalid_signature' });
      }
      return;
    }

    const secret = process.env[`ESIGN_WEBHOOK_SECRET_${provider.toUpperCase()}`];
    if (!secret) {
      this.logger.error({ provider }, 'no webhook secret configured for provider');
      throw Unauthorized({ code: 'webhook_provider_not_configured' });
    }
    if (!signature || !rawBody) {
      throw Unauthorized({ code: 'missing_signature_or_body' });
    }

    // SEC-034 — replay window. Same posture as Highsale: default-on,
    // ±5 minutes. Without this, a captured envelope (e.g. an attacker
    // who briefly accessed provider logs) could be re-fired months
    // later and would still verify, flipping an old envelope to
    // `signed` status and resuming a stale contract flow.
    const enforceReplay =
      (process.env['WEBHOOK_REPLAY_WINDOW_ENFORCED'] ?? 'true').toLowerCase() !==
      'false';

    if (enforceReplay) {
      if (!timestamp) {
        throw Unauthorized({ code: 'missing_timestamp' });
      }
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || ts <= 0) {
        throw Unauthorized({ code: 'invalid_timestamp' });
      }
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - ts) > 300) {
        throw Unauthorized({ code: 'webhook_replay_window_exceeded' });
      }
    }

    // The signed payload is `<ts>.<rawBody>` when enforcement is on,
    // so a captured signature can't be re-applied to a fresh timestamp.
    // When enforcement is off (rollover window), we sign rawBody alone
    // for compatibility with legacy senders.
    //
    // Real providers use their own header formats (DocuSign:
    // X-DocuSign-Signature-1, base64; Dropbox Sign:
    // x-hellosign-signature). Specialise per adapter when wired.
    const signedPayload =
      enforceReplay && timestamp ? `${timestamp}.${rawBody.toString('utf8')}` : rawBody;
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw Unauthorized({ code: 'invalid_signature' });
    }
  }
}

