import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import { MerchantService } from './merchant.service.js';
import { CreateMerchantDto } from './dto/create-merchant.dto.js';
import { AddBeneficialOwnerDto } from './dto/add-beneficial-owner.dto.js';
import { CreateApplicationLinkDto } from './dto/create-application-link.dto.js';

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchants: MerchantService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a merchant; calling user becomes the owner MerchantUser' })
  create(
    @CurrentUser() userId: UserId,
    @Body() dto: CreateMerchantDto,
  ): Promise<{ id: MerchantId; slug: string }> {
    return this.merchants.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get merchant detail (member access required)' })
  getOne(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.merchants.getOne(userId, id as MerchantId);
  }

  @Post(':id/beneficial-owners')
  @Idempotent()
  @ApiOperation({
    summary: 'Add a FinCEN BOI beneficial owner (PII envelope-encrypted server-side)',
  })
  addBeneficialOwner(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: AddBeneficialOwnerDto,
  ): Promise<{ id: string }> {
    return this.merchants.addBeneficialOwner(userId, merchantId as MerchantId, dto);
  }

  @Post(':id/kyb/start')
  @HttpCode(202)
  @Idempotent()
  @ApiOperation({ summary: 'Initiate KYB against the configured provider' })
  startKyb(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) merchantId: string,
  ): Promise<unknown> {
    return this.merchants.startKyb(userId, merchantId as MerchantId);
  }

  @Post(':id/application-links')
  @Idempotent()
  @ApiOperation({ summary: 'Generate a hosted application link (URL token returned ONCE)' })
  createApplicationLink(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: CreateApplicationLinkDto,
  ): Promise<unknown> {
    return this.merchants.createApplicationLink(userId, merchantId as MerchantId, dto);
  }
}
