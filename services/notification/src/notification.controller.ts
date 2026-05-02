import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '@eazepay/service-auth';
import type { UserId } from '@eazepay/shared-types';
import { NotificationService } from './notification.service.js';

const ListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the authenticated user' })
  list(
    @CurrentUser() userId: UserId,
    @Query() query: Record<string, string>,
  ): Promise<unknown> {
    const parsed = ListQuerySchema.parse(query);
    return this.notifications.listInbox(userId, parsed);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one notification read' })
  async markRead(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread in-app notifications read' })
  markAllRead(@CurrentUser() userId: UserId): Promise<{ updated: number }> {
    return this.notifications.markAllRead(userId);
  }
}
