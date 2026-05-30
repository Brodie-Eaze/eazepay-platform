import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaClient } from '@prisma/client';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { AuditedReadInterceptor } from './interceptors/audited-read.interceptor.js';
import { ErasureService } from './erasure.service.js';
import { LoanBackedRetentionPolicy } from './internal/loan-backed-retention-policy.js';
import { RETENTION_POLICY, type RetentionPolicy } from './ports/retention-policy.port.js';
import { PRISMA } from './internal/tokens.js';

export interface AdminModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /**
   * PRIV-014 — override the right-to-erasure retention-hold boundary.
   * Defaults to {@link LoanBackedRetentionPolicy} (BSA/AML CIP carve-out
   * + default-retain bias). Supplying a custom policy is the ONLY
   * supported way to change what gets shred vs retained — the shred
   * mechanics never move. Keep the default unless legal signs off on a
   * different boundary.
   */
  retentionPolicy?: RetentionPolicy;
}

@Module({})
export class AdminModule {
  static forRoot(options: AdminModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    // PRIV-014 — the retention-hold boundary is an injected provider so
    // the deletion-vs-retention decision is a swappable, reviewable unit.
    const retentionPolicy: Provider = {
      provide: RETENTION_POLICY,
      useValue: options.retentionPolicy ?? new LoanBackedRetentionPolicy(),
    };
    return {
      module: AdminModule,
      controllers: [AdminController, TeamController, MarketplaceController],
      providers: [
        prisma,
        Reflector,
        AdminService,
        TeamService,
        MarketplaceService,
        // SEC-018 — register the audited-read interceptor so
        // @UseInterceptors(AuditedReadInterceptor) on the controller
        // can resolve it from this module's DI scope.
        AuditedReadInterceptor,
        // PRIV-014 — right-to-erasure / crypto-shred.
        retentionPolicy,
        ErasureService,
      ],
      exports: [AdminService, TeamService, MarketplaceService, ErasureService],
    };
  }
}
