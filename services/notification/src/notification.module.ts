import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import {
  ConsoleEmailAdapter,
  ConsolePushAdapter,
  ConsoleSmsAdapter,
  InAppChannelAdapter,
} from './adapters/console-channel.adapter.js';
import { NOTIFICATION_CHANNEL_ADAPTERS } from './ports/notification-channel.port.js';
import { NOTIFY_PORT } from './ports/notify.port.js';
import { PRISMA } from './internal/tokens.js';

export interface NotificationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Per-channel provider selection. 'console' is dev only. */
  channels: {
    email: 'console' | 'ses' | 'sendgrid';
    sms: 'console' | 'twilio';
    push: 'console' | 'apns' | 'fcm' | 'pinpoint';
  };
  isDevelopment: boolean;
}

@Module({})
export class NotificationModule {
  static forRoot(options: NotificationModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const ensureDev = (channel: string, choice: string): void => {
      if (choice === 'console' && !options.isDevelopment) {
        throw new Error(
          `Console ${channel} adapter is dev-only — wire a production adapter for non-development.`,
        );
      }
    };
    ensureDev('email', options.channels.email);
    ensureDev('sms', options.channels.sms);
    ensureDev('push', options.channels.push);

    // For now, only console + in_app adapters exist. Real adapters
    // (SES, Twilio, APNs/FCM, Pinpoint) plug in here without changing
    // any caller — the channel router resolves by channel enum, not
    // adapter class.
    const adapters: Provider = {
      provide: NOTIFICATION_CHANNEL_ADAPTERS,
      useFactory: (
        email: ConsoleEmailAdapter,
        sms: ConsoleSmsAdapter,
        push: ConsolePushAdapter,
        inApp: InAppChannelAdapter,
      ) => [email, sms, push, inApp],
      inject: [ConsoleEmailAdapter, ConsoleSmsAdapter, ConsolePushAdapter, InAppChannelAdapter],
    };

    return {
      module: NotificationModule,
      // Global so any service can inject NOTIFY_PORT without each
      // module having to import NotificationModule's full configuration.
      global: true,
      controllers: [NotificationController],
      providers: [
        prisma,
        ConsoleEmailAdapter,
        ConsoleSmsAdapter,
        ConsolePushAdapter,
        InAppChannelAdapter,
        adapters,
        NotificationService,
        { provide: NOTIFY_PORT, useExisting: NotificationService },
      ],
      exports: [NotificationService, NOTIFY_PORT],
    };
  }
}
