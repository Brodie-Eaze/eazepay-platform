import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type NotificationChannel } from '@prisma/client';
import { BadRequest, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import {
  NOTIFICATION_CHANNEL_ADAPTERS,
  type NotificationChannelAdapter,
} from './ports/notification-channel.port.js';
import type { NotifyInput, NotifyPort } from './ports/notify.port.js';
import { getTemplate } from './templates/registry.js';

@Injectable()
export class NotificationService implements NotifyPort {
  private readonly logger = new Logger(NotificationService.name);
  private readonly byChannel = new Map<NotificationChannel, NotificationChannelAdapter>();

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(NOTIFICATION_CHANNEL_ADAPTERS)
    adapters: NotificationChannelAdapter[],
  ) {
    for (const a of adapters) this.byChannel.set(a.channel, a);
  }

  /**
   * Persist + dispatch in one call. Errors per-channel are isolated:
   * a failure on email does not block in_app delivery, etc.
   *
   * Sensitive content is NEVER stored in payload — payload carries
   * already-sanitised display values (display strings, masked counts,
   * subject ids). Anything that needs the live amount/PII reads it via
   * the subject ids at render time.
   */
  async notify(input: NotifyInput): Promise<void> {
    const template = getTemplate(input.templateKey);
    if (!template) {
      this.logger.warn({ templateKey: input.templateKey }, 'unknown notification template');
      return;
    }

    const channels = input.channels ?? template.channels;
    if (channels.length === 0) return;

    // For each channel, persist a row (queued) → resolve `to` → dispatch
    // → update status. We do per-channel persistence so partial failures
    // are visible in the inbox + audit trail.
    for (const channel of channels) {
      const adapter = this.byChannel.get(channel);
      if (!adapter) {
        this.logger.debug({ channel }, 'no adapter for channel; skipping');
        continue;
      }

      const to = await this.resolveDestination(input.userId as UserId, channel);
      if (!to && channel !== 'in_app') {
        // No address — record as suppressed so it shows in audit but isn't retried.
        await this.prisma.notification.create({
          data: {
            userId: input.userId,
            channel,
            templateKey: input.templateKey,
            payload: (input.payload ?? {}) as object,
            subjectType: input.subjectType ?? null,
            subjectId: input.subjectId ?? null,
            status: 'suppressed',
            failureReason: 'no_destination',
          },
        });
        continue;
      }

      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          channel,
          templateKey: input.templateKey,
          payload: (input.payload ?? {}) as object,
          subjectType: input.subjectType ?? null,
          subjectId: input.subjectId ?? null,
          status: 'queued',
        },
        select: { id: true },
      });

      try {
        const title = template.title(input.payload ?? {});
        const body = template.body(input.payload ?? {});
        const result = await adapter.send({
          notificationId: row.id,
          channel,
          to: to ?? '',
          title,
          body,
        });
        await this.prisma.notification.update({
          where: { id: row.id },
          data: {
            status: result.status,
            providerRef: result.providerRef ?? null,
            failureReason: result.failureReason ?? null,
            sentAt: result.status === 'sent' ? new Date() : null,
          },
        });
      } catch (err) {
        this.logger.error({ err, notificationId: row.id, channel }, 'channel dispatch threw');
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'failed', failureReason: 'adapter_exception' },
        });
      }
    }
  }

  async listInbox(
    userId: UserId,
    opts: { cursor?: string; limit: number; unreadOnly?: boolean },
  ): Promise<{
    items: Array<{
      id: string;
      channel: string;
      templateKey: string;
      payload: unknown;
      status: string;
      readAt: string | null;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        channel: 'in_app',
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });
    const hasMore = items.length > opts.limit;
    const sliced = hasMore ? items.slice(0, opts.limit) : items;
    return {
      items: sliced.map((n) => ({
        id: n.id,
        channel: n.channel,
        templateKey: n.templateKey,
        payload: n.payload,
        status: n.status,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  async markRead(userId: UserId, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, channel: 'in_app', readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw NotFound({ code: 'notification_not_found_or_already_read' });
    }
  }

  async markAllRead(userId: UserId): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, channel: 'in_app', readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // -------------- helpers --------------

  private async resolveDestination(
    userId: UserId,
    channel: NotificationChannel,
  ): Promise<string | null> {
    if (channel === 'in_app') return null; // not applicable
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phoneE164: true },
    });
    if (!user) throw BadRequest({ code: 'user_not_found' });
    switch (channel) {
      case 'email':
        return user.email;
      case 'sms':
      case 'push':
        // Push delivery would normally resolve a device token from a
        // separate Devices table. For MVP we co-opt phone E.164 so the
        // console adapter has something to render.
        return user.phoneE164;
      default:
        return null;
    }
  }
}
