import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '@eazepay/service-auth';
import { ApplicationService } from '@eazepay/service-application';
import { Unauthorized } from '@eazepay/shared-utils';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';

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
    summary: 'E-sign provider webhook receiver. Signature-verified per provider.',
  })
  async receive(
    @Param('provider') provider: string,
    @Headers('x-signature') signature: string | undefined,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ ok: true }> {
    this.verifySignature(provider, signature, req.rawBody);

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
    provider: string,
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): void {
    // Mock provider: signature header value MUST equal the literal
    // 'dev-mock' to keep the surface intentional even in local testing.
    if (provider === 'mock') {
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

    // Generic HMAC-SHA256 verification. Real providers use their own
    // header formats (DocuSign: X-DocuSign-Signature-1, base64; Dropbox
    // Sign: x-hellosign-signature). Specialise per adapter when wired.
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw Unauthorized({ code: 'invalid_signature' });
    }
  }
}

