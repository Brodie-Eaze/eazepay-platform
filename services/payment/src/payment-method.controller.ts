import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { PaymentMethodId, UserId } from '@eazepay/shared-types';
import type { PaymentService } from './payment.service.js';

const AddBankAccountSchema = z.object({
  publicToken: z.string().min(8).max(2048),
  setAsDefault: z.boolean().optional(),
});
class AddBankAccountDto extends createZodDto(AddBankAccountSchema) {}

@ApiTags('payment-methods')
@ApiBearerAuth()
@Controller('me/payment-methods')
export class PaymentMethodController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user`s payment methods' })
  list(@CurrentUser() userId: UserId): Promise<unknown> {
    return this.payments.listPaymentMethods(userId);
  }

  @Post('bank-accounts')
  @Idempotent()
  @ApiOperation({
    summary: 'Add a bank account by exchanging a Link public token (Plaid-shape)',
  })
  addBankAccount(@CurrentUser() userId: UserId, @Body() dto: AddBankAccountDto): Promise<unknown> {
    return this.payments.addBankAccount(userId, dto);
  }

  @Put(':id/default')
  @HttpCode(204)
  @ApiOperation({ summary: 'Make this payment method the default for collection' })
  async setDefault(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.payments.setDefaultPaymentMethod(userId, id as PaymentMethodId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a payment method (soft delete)' })
  async remove(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.payments.removePaymentMethod(userId, id as PaymentMethodId);
  }
}
