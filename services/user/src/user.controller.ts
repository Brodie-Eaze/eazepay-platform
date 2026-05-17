import { Body, Controller, Get, Headers, HttpCode, Ip, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { CurrentUser } from '@eazepay/service-auth';
import type { UserService } from './user.service.js';
import { type MeResponse, type StartKycResponse } from './user.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { StartKycDto } from './dto/start-kyc.dto.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @ApiOperation({
    summary:
      'Return the authenticated user and KYC state. Profile fields are MASKED by default (SEC-023); pass `?reveal=full` AFTER an OTP step-up to receive plaintext.',
  })
  // SEC-023 — default to masked PII.
  //
  // Threat scenario: pre-fix, `GET /v1/me` returned the FULL decrypted
  // ConsumerProfile (legal name, DOB, SSN-last-4, full address). A
  // stolen access JWT — from a malicious browser extension, an XSS
  // payload in any first-party surface, or a leaked log line — became
  // a one-shot PII exfil. The JWT TTL is 15 minutes, but a single
  // GET is enough to dump every field.
  //
  // Fix: default to MASKED. Callers who legitimately need plaintext
  // (the consumer themselves viewing their own profile in the settings
  // UI) opt in via `?reveal=full`, which requires a fresh OTP step-up
  // captured within the last 5 minutes via the otp.service step-up
  // purpose. For now we 403 on `?reveal=full` without a step-up token;
  // the actual step-up plumbing lands in a follow-up round.
  me(@CurrentUser() userId: UserId, @Query('reveal') reveal?: string): Promise<MeResponse> {
    return this.users.getMe(userId, { reveal: reveal === 'full' ? 'full' : 'masked' });
  }

  @Patch()
  @ApiOperation({ summary: 'Create or replace the encrypted PII profile' })
  update(@CurrentUser() userId: UserId, @Body() dto: UpdateProfileDto): Promise<MeResponse> {
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
