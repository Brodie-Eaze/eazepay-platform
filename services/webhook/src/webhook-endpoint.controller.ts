import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import { WebhookService } from './webhook.service.js';

const CreateEndpointSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().min(1).max(100)).min(1).max(50),
  description: z.string().max(200).optional(),
});
class CreateEndpointDto extends createZodDto(CreateEndpointSchema) {}

const ListDeliveriesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('merchants/:merchantId/webhooks')
export class WebhookEndpointController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post()
  @Idempotent()
  @ApiOperation({
    summary:
      'Create a webhook subscription. Secret returned ONCE; store it server-side and verify the X-EazePay-Signature on every delivery.',
  })
  create(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: CreateEndpointDto,
  ): Promise<unknown> {
    return this.webhooks.createEndpoint(userId, merchantId as MerchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhook subscriptions for this merchant' })
  list(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
  ): Promise<unknown> {
    return this.webhooks.listEndpoints(userId, merchantId as MerchantId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a webhook subscription (irreversible)' })
  async revoke(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.webhooks.revokeEndpoint(userId, merchantId as MerchantId, id);
  }

  @Post(':id/rotate-secret')
  @Idempotent()
  @ApiOperation({ summary: 'Rotate the signing secret. Returns the new secret ONCE.' })
  rotateSecret(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.webhooks.rotateSecret(userId, merchantId as MerchantId, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List delivery attempts for this endpoint' })
  listDeliveries(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: Record<string, string>,
  ): Promise<unknown> {
    const parsed = ListDeliveriesQuerySchema.parse(query);
    return this.webhooks.listDeliveries(userId, merchantId as MerchantId, id, parsed);
  }

  @Post('deliveries/:deliveryId/retry')
  @Idempotent()
  @ApiOperation({ summary: 'Replay a non-delivered webhook event' })
  retry(
    @CurrentUser() userId: UserId,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
  ): Promise<unknown> {
    return this.webhooks.retryDelivery(userId, merchantId as MerchantId, deliveryId);
  }
}
