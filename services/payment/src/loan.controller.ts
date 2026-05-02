import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@eazepay/service-auth';
import type { LoanId, UserId } from '@eazepay/shared-types';
import { PaymentService } from './payment.service.js';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoanController {
  constructor(private readonly payments: PaymentService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a loan owned by the authenticated user' })
  getOne(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.payments.getLoan(userId, id as LoanId);
  }

  @Get(':id/repayments')
  @ApiOperation({ summary: 'Repayment schedule for a loan' })
  repayments(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.payments.listRepayments(userId, id as LoanId);
  }
}
