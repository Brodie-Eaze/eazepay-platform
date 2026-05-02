import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditDrainService } from './audit-drain.service.js';
import { AUDIT_SINK } from './ports/audit-sink.port.js';
import { LocalFsAuditSink } from './adapters/local-fs-audit-sink.adapter.js';
import { PRISMA } from './internal/tokens.js';

export interface AuditModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Sink kind. 'local-fs' is dev only. */
  sink: 'local-fs' | 'dynamodb';
  /** Root dir for the local-fs sink. */
  localFsRoot?: string;
  /** Whether the drain cron runs in this process (single-replica only). */
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
    if (options.drainEnabled) providers.push(AuditDrainService);

    return {
      module: AuditModule,
      providers,
      exports: [AUDIT_SINK, ...(options.drainEnabled ? [AuditDrainService] : [])],
    };
  }
}
