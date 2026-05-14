import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { Public } from '@eazepay/service-auth';
import { NotFound, Unauthorized } from '@eazepay/shared-utils';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service.js';

const TierEnum = z.enum(['prime_plus', 'prime', 'near_prime', 'sub_prime', 'no_match']);

const PayloadSchema = z.object({
  /** Highsale's stable identifier for this snapshot. */
  highsaleRef: z.string().min(1).max(120),
  applicationId: z.string().uuid(),
  creditTier: TierEnum,
  ficoBand: z.string().min(1).max(40).optional(),
  /** SHA-256 of the inputs Highsale was given. We persist this so the
   *  audit chain can prove the snapshot belongs to this application's
   *  inputs (e.g. SSN-last-4 / DOB / address normalisation). Optional —
   *  if absent we compute one from the applicationId so the column is
   *  never null. */
  inputsHash: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  /** Provider's inquiry timestamp. */
  inquiryAt: z.string().datetime(),
  /** Snapshot validity window (per Highsale policy, ~14 days). */
  expiresAt: z.string().datetime(),
  /** Opaque financial payload — tradeline counts, income ranges, etc.
   *  We base64-encode JSON.stringify(payload) into HighsaleSnapshot's
   *  `payloadCiphertext` column for MVP. TODO: graduate to PiiVault with
   *  applicationId-bound AAD before SOC 2 Type II. */
  payload: z.record(z.unknown()),
});

/**
 * Highsale soft-pull webhook receiver.
 *
 * Highsale is our third-party credit + financial-data aggregator. It
 * issues a soft-pull `HighsaleSnapshot` for each Application; the
 * snapshot's `creditTier` is the routing fence that selects which
 * marketplace lenders are evaluated.
 *
 * Authenticity:
 *   Header `x-eazepay-signature: <hex>` MUST equal
 *   HMAC-SHA256(HIGHSALE_WEBHOOK_SECRET, rawBody).
 *   Constant-time compare; no secret = no requests served.
 *
 * Idempotency:
 *   `highsaleRef` is unique on HighsaleSnapshot. Replays upsert by ref,
 *   never duplicate.
 */
@ApiTags('webhooks')
@Public()
@Controller('webhooks/highsale')
export class HighsaleWebhookController {
  private readonly logger = new Logger(HighsaleWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Highsale soft-pull webhook. HMAC-SHA256 signature required; replays upsert by highsaleRef.',
  })
  async receive(
    @Headers('x-eazepay-signature') signature: string | undefined,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ ok: true; snapshotId: string; creditTier: string }> {
    this.verifySignature(signature, req.rawBody);

    const payload = PayloadSchema.parse(body);

    // Confirm the application exists before persisting; otherwise the
    // snapshot would be an orphan and the FK insert would fail anyway.
    const app = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { id: true, userId: true, status: true },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });

    const inputsHash =
      payload.inputsHash ??
      createHash('sha256').update(payload.applicationId).digest('hex');

    // Base64(JSON.stringify(payload)) — MVP placeholder for envelope
    // encryption. The orchestration engine never reads this; it reads
    // `creditTier` (denormalised) and `ficoBand`. Plaintext details are
    // accessed only via a JIT PII unmask path (future round).
    const payloadCiphertext = Buffer.from(JSON.stringify(payload.payload)).toString('base64');
    const payloadFingerprint = createHash('sha256')
      .update(payloadCiphertext)
      .digest('hex');

    const result = await this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.highsaleSnapshot.upsert({
        where: { highsaleRef: payload.highsaleRef },
        create: {
          applicationId: payload.applicationId,
          highsaleRef: payload.highsaleRef,
          creditTier: payload.creditTier,
          ficoBand: payload.ficoBand ?? null,
          payloadCiphertext,
          payloadFingerprint,
          inputsHash,
          inquiryAt: new Date(payload.inquiryAt),
          expiresAt: new Date(payload.expiresAt),
          status: 'scored',
        },
        update: {
          creditTier: payload.creditTier,
          ficoBand: payload.ficoBand ?? null,
          payloadCiphertext,
          payloadFingerprint,
          inputsHash,
          inquiryAt: new Date(payload.inquiryAt),
          expiresAt: new Date(payload.expiresAt),
          status: 'scored',
        },
        select: { id: true, creditTier: true },
      });

      // Denormalise the tier onto Application so the orchestration
      // engine and the partner-portal dashboards can filter without a
      // join. The HighsaleSnapshot row remains the source of truth.
      await tx.application.update({
        where: { id: payload.applicationId },
        data: { creditTier: payload.creditTier },
      });

      // Audit row — fits in the same hash-chain as the rest of the
      // platform. The `webhook` actorType marks an external (signed)
      // call; the targetId is the application so the chain is grouped
      // with everything else for that application.
      await tx.auditOutbox.create({
        data: {
          actorType: 'webhook',
          actorId: null,
          action: 'highsale.snapshot.scored',
          targetType: 'Application',
          targetId: payload.applicationId,
          after: {
            snapshotId: snapshot.id,
            highsaleRef: payload.highsaleRef,
            creditTier: payload.creditTier,
            ficoBand: payload.ficoBand ?? null,
            payloadFingerprint,
          },
        },
      });

      return snapshot;
    });

    this.logger.log(
      { applicationId: payload.applicationId, tier: payload.creditTier },
      'highsale snapshot scored',
    );

    return { ok: true, snapshotId: result.id, creditTier: result.creditTier };
  }

  private verifySignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): void {
    const secret = process.env['HIGHSALE_WEBHOOK_SECRET'];
    if (!secret) {
      this.logger.error('HIGHSALE_WEBHOOK_SECRET not configured; refusing webhook');
      throw Unauthorized({ code: 'webhook_provider_not_configured' });
    }
    if (!signature || !rawBody) {
      throw Unauthorized({ code: 'missing_signature_or_body' });
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    let a: Buffer;
    let b: Buffer;
    try {
      a = Buffer.from(expected, 'hex');
      b = Buffer.from(signature, 'hex');
    } catch {
      throw Unauthorized({ code: 'invalid_signature' });
    }
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw Unauthorized({ code: 'invalid_signature' });
    }
  }
}
