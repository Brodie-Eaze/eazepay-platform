import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { AuditDrainService } from './audit-drain.service.js';
import { AUDIT_SINK } from './ports/audit-sink.port.js';
import { LocalFsAuditSink } from './adapters/local-fs-audit-sink.adapter.js';
import { S3WormAuditSink } from './adapters/s3-worm.adapter.js';
import { AUDIT_DRAIN_CRON_OPTIONS, PRISMA } from './internal/tokens.js';
import { CronLeaderService } from './internal/cron-leader.service.js';
import { AuditChainVerifier } from './internal/chain-verify.cron.js';

export interface AuditModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Sink kind. 'local-fs' is dev only; 's3' is the prod target
   *  (currently a stub adapter — see s3-worm.adapter.ts). */
  sink: 'local-fs' | 'dynamodb' | 's3';
  /** Root dir for the local-fs sink. */
  localFsRoot?: string;
  /** Root dir for the s3 STUB sink (mimics the shape of S3 PUTs by
   *  writing to a local dlq/ directory). Required when sink='s3'
   *  until the real S3 client is wired. */
  s3StubRoot?: string;
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
            throw new Error('local-fs audit sink is dev-only — wire S3 for production.');
          }
          if (!options.localFsRoot) {
            throw new Error('local-fs audit sink requires localFsRoot');
          }
          return new LocalFsAuditSink(options.localFsRoot);
        }
        if (options.sink === 's3') {
          // STUB — see services/audit/src/adapters/s3-worm.adapter.ts
          // docstring. The dispatch path is wired so a production boot
          // with AUDIT_SINK=s3 resolves to a real class; the actual S3
          // PutObject + Object Lock wiring is a follow-up infra task.
          // Boot-time refusal in apps/api/src/config/env.ts guarantees
          // production never reaches this factory with any other value.
          if (!options.s3StubRoot) {
            throw new Error('s3 audit sink stub requires s3StubRoot');
          }
          return new S3WormAuditSink(options.s3StubRoot);
        }
        throw new Error(`audit sink ${options.sink} not yet implemented`);
      },
    };

    // AuditChainVerifier is always registered — it is a pure on-disk
    // walker, not a cron, so a non-leader replica can still expose it
    // through an admin endpoint to trigger an on-demand verification.
    // The daily-cron wrapper around it is gated by the leader flags
    // below alongside the drain.
    const providers: Provider[] = [prisma, sink, AuditChainVerifier];
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
      exports: [AUDIT_SINK, AuditChainVerifier, ...(cronShouldRun ? [AuditDrainService] : [])],
    };
  }
}
