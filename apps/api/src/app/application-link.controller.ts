import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, Public } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { MerchantService } from '@eazepay/service-merchant';
import { ApplicationService } from '@eazepay/service-application';

const RedeemSchema = z.object({
  category: z.enum([
    'auto',
    'home_improvement',
    'medical',
    'retail',
    'personal',
    'consolidation',
  ]),
  requestedAmountCents: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .transform((v) => BigInt(v)),
  termMonths: z.number().int().min(1).max(120),
  purposeDetail: z.string().max(500).optional(),
});
class RedeemDto extends createZodDto(RedeemSchema) {}

/**
 * Hosted apply page contract:
 *  GET  /v1/application-links/:slug/:token        — public, returns merchant
 *                                                    + pre-fill context for
 *                                                    rendering. Does NOT
 *                                                    consume the token.
 *  POST /v1/application-links/:slug/:token/redeem — authenticated; consumes
 *                                                    the token and creates a
 *                                                    draft Application bound
 *                                                    to the merchant.
 *
 * Composition lives in apps/api so neither service-merchant nor
 * service-application has to depend on the other.
 */
@ApiTags('application-links')
@Controller('application-links')
export class ApplicationLinkController {
  constructor(
    private readonly merchants: MerchantService,
    private readonly applications: ApplicationService,
  ) {}

  @Public()
  @Get(':slug/:token')
  @ApiOperation({ summary: 'Public — return merchant context for the apply page' })
  context(
    @Param('slug') slug: string,
    @Param('token') token: string,
  ): Promise<unknown> {
    return this.merchants.getLinkContext(slug, token);
  }

  @Post(':slug/:token/redeem')
  @Idempotent()
  @HttpCode(201)
  @ApiOperation({ summary: 'Consume the link and create a draft Application' })
  async redeem(
    @CurrentUser() userId: UserId,
    @Param('slug') slug: string,
    @Param('token') token: string,
    @Body() dto: RedeemDto,
  ): Promise<unknown> {
    // 1. Re-validate the link freshly. We re-read inside the same call to
    //    catch races where it was consumed between context() and redeem().
    const ctx = await this.merchants.getLinkContext(slug, token);

    // 2. Create the draft Application bound to the merchant + channel.
    const app = await this.applications.create(userId, {
      channel: 'merchant_link',
      merchantId: ctx.merchantId,
      category: (dto.category as ReturnType<typeof RedeemDto.prototype>['category']) ?? 'personal',
      requestedAmountCents: dto.requestedAmountCents,
      termMonths: dto.termMonths,
      purposeDetail: dto.purposeDetail,
    } as never);

    // 3. Mark link consumed; if this fails (race), the draft Application
    //    is left in place — the consumer can submit it; the merchant just
    //    won't see it as the link's redeemer. Better than failing the
    //    whole call after the application exists.
    try {
      await this.merchants.markLinkUsed(ctx.linkId, app.id as ApplicationId);
    } catch {
      // swallow — see comment above. Audit row already written for the
      // application.created event.
    }

    return app;
  }
}
