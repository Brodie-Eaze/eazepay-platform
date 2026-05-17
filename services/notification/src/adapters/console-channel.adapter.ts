import { Injectable, Logger } from '@nestjs/common';
import type {
  ChannelDeliverInput,
  ChannelDeliverResult,
  NotificationChannelAdapter,
} from '../ports/notification-channel.port.js';
import type { NotificationChannel } from '@prisma/client';

/**
 * DEV ONLY. Emits to stdout. Used by the dispatcher whenever the
 * configured production adapter for a channel isn't available, OR for
 * the in_app channel where the "delivery" is just persisting the
 * Notification row (no external rail involved).
 */
function makeConsoleAdapter(
  name: string,
  channel: NotificationChannel,
): NotificationChannelAdapter {
  return new (class implements NotificationChannelAdapter {
    readonly name = name;
    readonly channel = channel;
    private readonly logger = new Logger(`${name}:${channel}`);

    async send(input: ChannelDeliverInput): Promise<ChannelDeliverResult> {
      this.logger.warn(`[DEV-ONLY] ${channel} → ${input.to} | ${input.title}\n${input.body}`);
      return { status: 'sent', providerRef: `console-${input.notificationId}` };
    }
  })();
}

@Injectable()
export class ConsolePushAdapter implements NotificationChannelAdapter {
  private readonly delegate = makeConsoleAdapter('console-push', 'push');
  readonly name = this.delegate.name;
  readonly channel = this.delegate.channel;
  send = (i: ChannelDeliverInput) => this.delegate.send(i);
}

@Injectable()
export class ConsoleEmailAdapter implements NotificationChannelAdapter {
  private readonly delegate = makeConsoleAdapter('console-email', 'email');
  readonly name = this.delegate.name;
  readonly channel = this.delegate.channel;
  send = (i: ChannelDeliverInput) => this.delegate.send(i);
}

@Injectable()
export class ConsoleSmsAdapter implements NotificationChannelAdapter {
  private readonly delegate = makeConsoleAdapter('console-sms', 'sms');
  readonly name = this.delegate.name;
  readonly channel = this.delegate.channel;
  send = (i: ChannelDeliverInput) => this.delegate.send(i);
}

/**
 * In-app "delivery" is a no-op at the channel layer: the row already
 * exists in the DB and the consumer reads it via GET /v1/me/notifications.
 * This adapter just acknowledges the dispatch.
 */
@Injectable()
export class InAppChannelAdapter implements NotificationChannelAdapter {
  readonly name = 'in_app';
  readonly channel: NotificationChannel = 'in_app';
  async send(input: ChannelDeliverInput): Promise<ChannelDeliverResult> {
    return { status: 'sent', providerRef: `in_app-${input.notificationId}` };
  }
}
