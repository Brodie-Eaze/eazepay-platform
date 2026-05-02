import { Body, Controller, Get, Headers, HttpCode, Ip, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { CurrentUser } from '@eazepay/service-auth';
import { UserService, type MeResponse, type StartKycResponse } from './user.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { StartKycDto } from './dto/start-kyc.dto.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Return the authenticated user, KYC state, and decrypted profile' })
  me(@CurrentUser() userId: UserId): Promise<MeResponse> {
    return this.users.getMe(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Create or replace the encrypted PII profile' })
  update(
    @CurrentUser() userId: UserId,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    return this.users.updateProfile(userId, dto);
  }

  @Post('kyc/start')
  @HttpCode(202)
  @Idempotent()
  @ApiOperation({ summary: 'Initiate KYC against the configured provider' })
  startKyc(
    @CurrentUser() userId: UserId,
    @Body() _dto: StartKycDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<StartKycResponse> {
    return this.users.startKyc(userId, ip, userAgent);
  }
}
