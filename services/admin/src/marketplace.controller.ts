import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard, AdminOnly, CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MarketplaceService } from './marketplace.service.js';

const CreditTierEnum = z.enum(['prime_plus', 'prime', 'near_prime', 'sub_prime', 'no_match']);
const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay', 'direct']);

const LendersQuerySchema = z.object({
  marketplaceId: z.string().uuid().optional(),
  brand: BrandEnum.optional(),
  tier: CreditTierEnum.optional(),
  enabled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const UpdateLenderSchema = z
  .object({
    globallyEnabled: z.boolean().optional(),
    servesTiers: z.array(CreditTierEnum).optional(),
    brands: z.array(BrandEnum).optional(),
    minScore: z.number().int().min(300).max(900).nullable().optional(),
    permittedStates: z
      .array(z.string().length(2).toUpperCase())
      .max(56)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });
class UpdateLenderDto extends createZodDto(UpdateLenderSchema) {}

const SetAccessSchema = z
  .object({
    merchantId: z.string().uuid(),
    marketplaceLenderId: z.string().uuid(),
    enabled: z.boolean().optional(),
    inherit: z.literal(true).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => (v.enabled !== undefined) !== !!v.inherit, {
    message: 'pass either `enabled` OR `inherit:true`, never both/neither',
  });
class SetAccessDto extends createZodDto(SetAccessSchema) {}

const AccessQuerySchema = z.object({
  merchantId: z.string().uuid(),
});

/**
 * Master Command Centre — lender marketplace + per-partner access.
 *
 * Surfaces the data the Marketplace Approvals + Access Matrix pages in
 * the partner portal need:
 *
 *   GET   /v1/admin/marketplaces
 *   GET   /v1/admin/marketplace-lenders            (filterable)
 *   PATCH /v1/admin/marketplace-lenders/:id        (toggle / re-fence)
 *   GET   /v1/admin/partner-lender-access?merchantId=…
 *   POST  /v1/admin/partner-lender-access           (upsert / inherit)
 */
@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AdminGuard)
@Controller('admin')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('marketplaces')
  @ApiOperation({ summary: 'List connected wholesale marketplaces' })
  listMarketplaces(@CurrentUser() _adminUserId: UserId): Promise<unknown> {
    return this.marketplace.listMarketplaces();
  }

  @Get('marketplace-lenders')
  @ApiOperation({
    summary:
      'List marketplace lenders, filterable by marketplace, brand allowlist, credit tier, and global-enabled state',
  })
  listLenders(
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string>,
  ): Promise<unknown> {
    const q = LendersQuerySchema.parse(raw);
    return this.marketplace.listMarketplaceLenders({
      marketplaceId: q.marketplaceId,
      brand: q.brand,
      tier: q.tier,
      enabled: q.enabled,
    });
  }

  @Patch('marketplace-lenders/:id')
  @Idempotent()
  @ApiOperation({
    summary:
      'Update a marketplace lender: global enable, tier coverage, brand allowlist, min score, permitted states',
  })
  updateLender(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLenderDto,
  ): Promise<unknown> {
    return this.marketplace.updateMarketplaceLender(adminUserId, id, {
      globallyEnabled: dto.globallyEnabled,
      servesTiers: dto.servesTiers,
      brands: dto.brands,
      minScore: dto.minScore,
      permittedStates: dto.permittedStates,
    });
  }

  @Get('partner-lender-access')
  @ApiOperation({
    summary:
      'List the per-partner access matrix for a merchant — one row per marketplace lender, with effective and inherited values',
  })
  listAccess(
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string>,
  ): Promise<unknown> {
    const q = AccessQuerySchema.parse(raw);
    return this.marketplace.listPartnerAccess(q.merchantId);
  }

  @Post('partner-lender-access')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({
    summary:
      'Upsert a per-partner lender access override. Pass `{enabled:true|false}` to force, or `{inherit:true}` to fall back to the global value.',
  })
  setAccess(
    @CurrentUser() adminUserId: UserId,
    @Body() dto: SetAccessDto,
  ): Promise<unknown> {
    return this.marketplace.setPartnerAccess(adminUserId, {
      merchantId: dto.merchantId,
      marketplaceLenderId: dto.marketplaceLenderId,
      enabled: dto.enabled,
      inherit: dto.inherit,
      reason: dto.reason,
    });
  }
}
