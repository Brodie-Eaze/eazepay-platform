import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { AuditDrainService } from './audit-drain.service.js';
import { AUDIT_SINK } from './ports/audit-sink.port.js';
import { LocalFsAuditSink } from './adapters/local-fs-audit-sink.adapter.js';
import {
  S3AuditWormAdapter,
  loadS3AuditWormConfigFromEnv,
} from './adapters/s3-audit-worm.adapter.js';
import { S3AuditDrainSink } from './adapters/s3-audit-drain-sink.adapter.js';
import { AUDIT_DRAIN_CRON_OPTIONS, PRISMA } from './internal/tokens.js';
import { CronLeaderService } from './internal/cron-leader.service.js';

export interface AuditModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Sink kind. 'local-fs' is dev only; 's3-aws' is the production
   *  target backed by S3 Object Lock (GOVERNANCE, 7yr retain). */
  sink: 'local-fs' | 'dynamodb' | 's3-aws';
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
        if (options.sink === 's3-aws') {
          // Construction throws fast (and loud) if any AWS env var is
          // missing — boot-time guard is intentional. The drain wraps
          // the WORM adapter in an in-process chain-head bridge so the
          // drain port's `put(record)` contract is satisfied without
          // round-tripping S3 for each chain head fetch.
          const cfg = loadS3AuditWormConfigFromEnv();
          const worm = new S3AuditWormAdapter(cfg);
          return new S3AuditDrainSink(worm);
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
      // Postgres advisory-lock leader election — PRIMARY mechanism that
      // makes the cron safe against env-flag misconfiguration.
      providers.push(CronLeaderService);
      providers.push(AuditDrainService);
    }

    return {
      module: AuditModule,
      providers,
      exports: [AUDIT_SINK, ...(cronShouldRun ? [AuditDrainService] : [])],
    };
  }
}
