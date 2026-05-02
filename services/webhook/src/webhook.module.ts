import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WebhookService } from './webhook.service.js';
import { WebhookEndpointController } from './webhook-endpoint.controller.js';
import { WebhookDispatcher } from './internal/dispatcher.service.js';
import { WEBHOOK_PUBLISHER } from './ports/webhook-publisher.port.js';
import { PRISMA } from './internal/tokens.js';

export interface WebhookModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Whether the dispatcher cron runs in this process. In a multi-replica
   *  deploy, only ONE replica should set this true (mirrors the
   *  collection cron pattern in services/payment). */
  dispatcherEnabled: boolean;
}

@Module({})
export class WebhookModule {
  static forRoot(options: WebhookModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    const providers: Provider[] = [
      prisma,
      WebhookService,
      { provide: WEBHOOK_PUBLISHER, useExisting: WebhookService },
    ];
    if (options.dispatcherEnabled) providers.push(WebhookDispatcher);
    return {
      module: WebhookModule,
      // Global so any service can inject WEBHOOK_PUBLISHER without
      // re-importing the dispatcher / endpoint configuration.
      global: true,
      controllers: [WebhookEndpointController],
      providers,
      exports: [WebhookService, WEBHOOK_PUBLISHER],
    };
  }
}
