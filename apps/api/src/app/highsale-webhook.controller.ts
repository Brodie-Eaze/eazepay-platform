/**
 * Highsale snapshot ingestion — payload-at-rest encryption.
 *
 * MIGRATION NOTE (read before changing this file):
 *   Pre-fix HighsaleSnapshot rows had `payloadCiphertext` filled with
 *   `Buffer.from(JSON.stringify(payload)).toString('base64')` — that is
 *   ENCODING, not encryption. Anyone with row access could decode it.
 *   This file now seals the payload via PiiVaultService.sealOpaque with
 *   AAD bound to the applicationId, producing a real envelope (per-row
 *   DEK wrapped by a KEK held in the key manager / KMS).
 *
 *   Existing legacy rows WILL FAIL to decrypt — they were never encrypted,
 *   just base64'd. The operator-side backfill plan is:
 *     1. Stop emitting new legacy rows (this commit does that).
 *     2. Run a one-shot backfill script that, for each row whose envelope
 *        does not parse as our v1 JSON envelope, reads the base64 payload,
 *        seals it via sealOpaque({ scope: 'highsale_snapshot', applicationId }),
 *        and writes it back.
 *     3. Until backfilled, any future "unmask" endpoint must try
 *        openOpaque first and fall back to plain base64 decode for
 *        legacy rows. There is no such reader today, so the fallback
 *        lives in the backfill script, not in production code.
 */
import { Body, Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { Public } from '@eazepay/service-auth';
import { NotFound, Unauthorized } from '@eazepay/shared-utils';
import type { PiiVaultService } from '@eazepay/service-user';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import type { PrismaService } from '../prisma/prisma.service.js';

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
  inputsHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional(),
  /** Provider's inquiry timestamp. */
  inquiryAt: z.string().datetime(),
  /** Snapshot validity window (per Highsale policy, ~14 days). */
  expiresAt: z.string().datetime(),
  /** Opaque financial payload — tradeline counts, income ranges, etc.
   *  Envelope-encrypted via PiiVaultService.sealOpaque with AAD bound
   *  to applicationId. The encoded string lands in HighsaleSnapshot's
   *  `payloadCiphertext` column. */
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
 *   HMAC-SHA256(HIGHSALE_WEBHOOK_SECRET, `<ts>.<rawBody>`)
 *   where `<ts>` is the Unix-seconds value of header
 *   `x-eazepay-timestamp`. Constant-time compare; no secret = no
 *   requests served.
 *
 * SEC-034 — replay window:
 *   We reject when |now - ts| > 300 seconds so a captured webhook
 *   can't be replayed once the window passes. The timestamp is baked
 *   into the HMAC so the same envelope can't be re-signed without the
 *   secret. Default-on in all environments; an operator can flip it
 *   off via `WEBHOOK_REPLAY_WINDOW_ENFORCED=false` for a short
 *   migration window if a partner needs time to adopt the header.
 *
 * Idempotency:
 *   `highsaleRef` is unique on HighsaleSnapshot. Replays inside the
 *   ±5 minute window upsert by ref and never duplicate. Outside the
 *   window the receiver refuses the request entirely.
 */
@ApiTags('webhooks')
@Public()
@Controller('webhooks/highsale')
export class HighsaleWebhookController {
  private readonly logger = new Logger(HighsaleWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly piiVault: PiiVaultService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Highsale soft-pull webhook. HMAC-SHA256 signature required (timestamp baked in for SEC-034 replay protection); replays upsert by highsaleRef.',
  })
  async receive(
    @Headers('x-eazepay-signature') signature: string | undefined,
    @Headers('x-eazepay-timestamp') timestamp: string | undefined,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ ok: true; snapshotId: string; creditTier: string }> {
    this.verifySignature(signature, timestamp, req.rawBody);

    const payload = PayloadSchema.parse(body);

    // Confirm the application exists before persisting; otherwise the
    // snapshot would be an orphan and the FK insert would fail anyway.
    const app = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      select: { id: true, userId: true, status: true },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });

    const inputsHash =
      payload.inputsHash ?? createHash('sha256').update(payload.applicationId).digest('hex');

    // Envelope-encrypt the financial payload at rest. Base64 alone was
    // the prior MVP behaviour — base64 is NOT encryption, just encoding;
    // anyone with row read access could decode it back to plaintext.
    //
    // AAD = { scope: 'highsale_snapshot', applicationId }. Authenticated
    // Additional Data is mixed into the GCM tag at encrypt time and
    // re-supplied at decrypt time; if anyone lifts this ciphertext out
    // of application A's row and inserts it onto application B, the
    // GCM tag check fails and decryption throws. That binding is what
    // stops cross-application snapshot transplants.
    //
    // The orchestration engine never reads this column — it reads
    // `creditTier` (denormalised on Application) and `ficoBand`.
    // Plaintext details are accessed only via a JIT unmask path
    // (future round) that must call PiiVaultService.openOpaque with
    // the same AAD context.
    const payloadJson = JSON.stringify(payload.payload);
    const payloadCiphertext = await this.piiVault.sealOpaque(payloadJson, {
      scope: 'highsale_snapshot',
      applicationId: payload.applicationId,
    });
    // Fingerprint over plaintext bytes — lets the audit chain prove
    // "this snapshot's payload is unchanged" without ever revealing the
    // payload itself, and is stable across re-encryption (e.g. KEK
    // rotation, which changes ciphertext but not plaintext).
    const payloadFingerprint = createHash('sha256').update(payloadJson).digest('hex');

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
    timestamp: string | undefined,
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

    // SEC-034 — replay window. Defaults to enforced; the operator can
    // opt out via WEBHOOK_REPLAY_WINDOW_ENFORCED=false during a partner
    // rollover (NOT a long-term posture).
    const enforceReplay =
      (process.env['WEBHOOK_REPLAY_WINDOW_ENFORCED'] ?? 'true').toLowerCase() !== 'false';

    if (enforceReplay) {
      if (!timestamp) {
        throw Unauthorized({ code: 'missing_timestamp' });
      }
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || ts <= 0) {
        throw Unauthorized({ code: 'invalid_timestamp' });
      }
      // Window is 300 seconds (5 minutes) on either side of our clock —
      // wide enough for normal clock skew + a slow retry from the
      // provider, narrow enough that a leaked envelope is useless by
      // the time an attacker discovers it. Capture-replay attacks
      // beyond 5 minutes need to forge the HMAC, which they can't
      // without the secret.
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - ts) > 300) {
        throw Unauthorized({ code: 'webhook_replay_window_exceeded' });
      }
    }

    // The signed payload is `<ts>.<rawBody>` when enforcement is on, so
    // a captured signature can't be re-applied to a fresh timestamp.
    // When enforcement is off (rollover window), we sign rawBody alone
    // for compatibility with legacy senders.
    const signedPayload =
      enforceReplay && timestamp ? `${timestamp}.${rawBody.toString('utf8')}` : rawBody;
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
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
