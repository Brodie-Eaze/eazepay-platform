import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { BillingService } from './billing.service.js';

/** Minimal request shape we need from the platform-fastify adapter —
 *  avoids depending on fastify types in a service package. */
interface MinimalRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}
import type { ConfirmDecisionDto } from './dto/invoice.dto.js';

/**
 * Public confirm/dispute surface. Reached by the recipient via the
 * tokenised link in the invoice email.
 *
 * Posture:
 *   - No auth. Token IS the credential.
 *   - Tight throttle (10 req/min/IP for the GET, 5 req/min/IP for the
 *     POST) so a leaked token can't be brute-forced; the token itself
 *     is 256 bits of entropy so brute force is computationally
 *     infeasible — throttle is a belt + braces.
 *   - Decisions are one-shot: subsequent POSTs return 409.
 *   - We store remoteIp + userAgent on the decision row + activity
 *     so the audit chain has a forensic anchor without storing PII.
 *   - Token expiry is enforced in the service.
 *
 * This controller is mounted under `/public/billing/...` (no JwtAuth
 * guard) — confirm `apps/api` app module wires it accordingly.
 */
@ApiTags('billing-public')
@Controller('public/billing/confirm')
export class BillingConfirmController {
  constructor(private readonly billing: BillingService) {}

  @Get(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resolve a confirm token → invoice summary' })
  async resolve(@Param('token') token: string) {
    return this.billing.resolveConfirmToken(token);
  }

  @Post(':token')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record recipient decision (confirm or dispute)' })
  async decide(
    @Param('token') token: string,
    @Body() dto: ConfirmDecisionDto,
    @Req() req: MinimalRequest,
    @Headers('user-agent') ua?: string,
  ) {
    const fwd = req.headers?.['x-forwarded-for'];
    const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
    const remoteIp = (req.ip || fwdStr || '').split(',')[0]?.trim();
    return this.billing.applyConfirmDecision(token, dto.decision, {
      remoteIp: remoteIp || undefined,
      userAgent: ua,
      reason: dto.reason,
    });
  }
}
