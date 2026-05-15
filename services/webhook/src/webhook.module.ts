import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WebhookService } from './webhook.service.js';
import { WebhookEndpointController } from './webhook-endpoint.controller.js';
import { WebhookDispatcher } from './internal/dispatcher.service.js';
import { WEBHOOK_PUBLISHER } from './ports/webhook-publisher.port.js';
import { DISPATCHER_CRON_OPTIONS, PRISMA } from './internal/tokens.js';

export interface WebhookModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Umbrella leader gate — set by the caller from `env.CRON_LEADER`.
   *  When false on a replica, NO cron in this process fires, even if
   *  `dispatcherEnabled` is true. Multi-replica safety lives here. */
  cronLeader: boolean;
  /** Per-cron kill-switch for the outbound webhook dispatcher.
   *  Independent of `cronLeader` so an operator can pause webhook
   *  delivery during an incident without disabling other crons. Both
   *  flags must be true for the cron to run. */
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
    // Provider-registration gate: cron class is only instantiated when
    // BOTH flags are true. We still inject the options into the cron
    // service so the handler-entry guard inside it is defensive even if
    // a future caller wires it up under different conditions.
    const cronShouldRun = options.cronLeader && options.dispatcherEnabled;
    if (cronShouldRun) {
      providers.push({
        provide: DISPATCHER_CRON_OPTIONS,
        useValue: {
          cronLeader: options.cronLeader,
          dispatcherEnabled: options.dispatcherEnabled,
        },
      });
      providers.push(WebhookDispatcher);
    }
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
