import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard, AdminOnly, CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import type { BillingService } from './billing.service.js';
import type { BillingConfigPatchDto } from './dto/billing-config.dto.js';
import type {
  ComposeSendDto,
  GenerateBatchDto,
  ListInvoicesQueryDto,
  RecordPaymentDto,
  SetAmountDto,
  SetDueDateDto,
  SetFeePctDto,
  SetStatusDto,
  VoidInvoiceDto,
} from './dto/invoice.dto.js';

/**
 * Admin-only billing surface.
 *
 * Posture:
 *   - JWT + Admin guard on every endpoint via @AdminOnly().
 *   - Per-controller Throttle window tighter than the app default so a
 *     compromised admin token can't be used to mass-mutate before
 *     incident response kicks in.
 *   - Every write goes through @Idempotent so retries are safe.
 *   - All mutations write an InvoiceActivity row in the same DB
 *     transaction as the state change (handled by BillingService).
 *   - Responses never echo PII back to the wire unless the caller
 *     specifically asks for the decrypted billing config view.
 */
@ApiTags('billing')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  private actor(userId: UserId): { id: string; label: string } {
    return { id: userId as unknown as string, label: userId as unknown as string };
  }

  /* ─── Billing configs ───────────────────────────────────────── */

  @Get('configs')
  @ApiOperation({ summary: 'List billing configs with decrypted send-to email (admin only)' })
  listConfigs() {
    return this.billing.listConfigs();
  }

  @Patch('configs/:merchantId')
  @Idempotent()
  @ApiOperation({ summary: 'Create or update a merchant billing config' })
  patchConfig(
    @CurrentUser() userId: UserId,
    @Param('merchantId') merchantId: string,
    @Body() dto: BillingConfigPatchDto,
  ) {
    return this.billing.patchConfig(merchantId, dto, this.actor(userId));
  }

  /* ─── Generate from activity ────────────────────────────────── */

  @Get('generate/preview')
  @ApiOperation({ summary: 'Preview what "Generate from activity" would create' })
  previewGenerate(@Query('periodId') periodId: string) {
    return this.billing.previewGenerate(periodId);
  }

  @Post('generate')
  @HttpCode(200)
  @Idempotent()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Run "Generate from activity" for a period' })
  runGenerate(@CurrentUser() userId: UserId, @Body() dto: GenerateBatchDto) {
    return this.billing.runGenerate(dto.periodId, this.actor(userId));
  }

  /* ─── Invoice queries + mutations ───────────────────────────── */

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices with optional filters' })
  list(@Query() query: ListInvoicesQueryDto) {
    return this.billing.listInvoices(query);
  }

  @Get('invoices/:invoiceNo')
  @ApiOperation({ summary: 'Get one invoice with payment history + activity log' })
  getOne(@Param('invoiceNo') invoiceNo: string) {
    return this.billing.getInvoice(invoiceNo);
  }

  @Patch('invoices/:invoiceNo/status')
  @Idempotent()
  @ApiOperation({ summary: 'Flip invoice status (draft/sent/paid/overdue)' })
  setStatus(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.billing.setStatus(invoiceNo, dto.status, this.actor(userId));
  }

  @Patch('invoices/:invoiceNo/fee-pct')
  @Idempotent()
  @ApiOperation({ summary: 'Override fee % (recomputes amount unless previously overridden)' })
  setFeePct(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: SetFeePctDto,
  ) {
    return this.billing.setFeePct(invoiceNo, dto.feePct, this.actor(userId));
  }

  @Patch('invoices/:invoiceNo/amount')
  @Idempotent()
  @ApiOperation({ summary: 'Override invoice amount (cents)' })
  setAmount(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: SetAmountDto,
  ) {
    return this.billing.setAmount(invoiceNo, dto.amountCents, this.actor(userId));
  }

  @Patch('invoices/:invoiceNo/due-date')
  @Idempotent()
  @ApiOperation({ summary: 'Update due date (YYYY-MM-DD)' })
  setDueDate(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: SetDueDateDto,
  ) {
    return this.billing.setDueDate(invoiceNo, dto.dueDate, this.actor(userId));
  }

  @Post('invoices/:invoiceNo/void')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({ summary: 'Void an invoice with a reason (audited)' })
  voidInvoice(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.billing.voidInvoice(invoiceNo, dto.reason, this.actor(userId));
  }

  @Post('invoices/:invoiceNo/unvoid')
  @HttpCode(200)
  @Idempotent()
  @ApiOperation({ summary: 'Reverse a void (audited)' })
  unvoidInvoice(@CurrentUser() userId: UserId, @Param('invoiceNo') invoiceNo: string) {
    return this.billing.unvoidInvoice(invoiceNo, this.actor(userId));
  }

  @Post('invoices/:invoiceNo/payments')
  @HttpCode(201)
  @Idempotent()
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billing.recordPayment(invoiceNo, dto, this.actor(userId));
  }

  /* ─── Confirm token issuance (admin) ────────────────────────── */

  @Post('invoices/:invoiceNo/confirm-token')
  @HttpCode(201)
  @Idempotent()
  @ApiOperation({
    summary: 'Mint a confirm/dispute token for the Send composer; returns {token, expiresAt}',
  })
  mintConfirmToken(
    @CurrentUser() userId: UserId,
    @Param('invoiceNo') invoiceNo: string,
    @Body() _dto: ComposeSendDto,
  ) {
    return this.billing.mintConfirmToken(invoiceNo, this.actor(userId));
  }
}
