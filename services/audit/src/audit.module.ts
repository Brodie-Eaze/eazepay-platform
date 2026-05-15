import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditDrainService } from './audit-drain.service.js';
import { AUDIT_SINK } from './ports/audit-sink.port.js';
import { LocalFsAuditSink } from './adapters/local-fs-audit-sink.adapter.js';
import { AUDIT_DRAIN_CRON_OPTIONS, PRISMA } from './internal/tokens.js';

export interface AuditModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Sink kind. 'local-fs' is dev only. */
  sink: 'local-fs' | 'dynamodb';
  /** Root dir for the local-fs sink. */
  localFsRoot?: string;
  /** Umbrella leader gate — set by the caller from `env.CRON_LEADER`.
   *  When false on a replica, NO cron in this process fires, even if
   *  `drainEnabled` is true. Multi-replica safety lives here. */
  cronLeader: boolean;
  /** Per-cron kill-switch. False disables the drain even when this
   *  process is the leader. Both flags must be true for the drain to
   *  fire. */
  drainEnabled: boolean;
  isDevelopment: boolean;
}

@Module({})
export class AuditModule {
  static forRoot(options: AuditModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const sink: Provider = {
      provide: AUDIT_SINK,
      useFactory: () => {
        if (options.sink === 'local-fs') {
          if (!options.isDevelopment) {
            throw new Error('local-fs audit sink is dev-only — wire DynamoDB for production.');
          }
          if (!options.localFsRoot) {
            throw new Error('local-fs audit sink requires localFsRoot');
          }
          return new LocalFsAuditSink(options.localFsRoot);
        }
        throw new Error(`audit sink ${options.sink} not yet implemented`);
      },
    };

    const providers: Provider[] = [prisma, sink];
    // Provider-registration gate: drain class is only instantiated when
    // BOTH flags are true. The handler-entry check inside the service
    // is defense in depth on top of this.
    const cronShouldRun = options.cronLeader && options.drainEnabled;
    if (cronShouldRun) {
      providers.push({
        provide: AUDIT_DRAIN_CRON_OPTIONS,
        useValue: {
          cronLeader: options.cronLeader,
          drainEnabled: options.drainEnabled,
        },
      });
      providers.push(AuditDrainService);
    }

    return {
      module: AuditModule,
      providers,
      exports: [AUDIT_SINK, ...(cronShouldRun ? [AuditDrainService] : [])],
    };
  }
}
