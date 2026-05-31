import { Module } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { OrchestrationService } from './orchestration.service.js';
import { DecisionService } from './decision/decision.service.js';
import { DecideController } from './decide.controller.js';
import {
  DecisionPrismaRepository,
  DECISION_REPOSITORY_PORT,
} from './decision/persistence.prisma.js';
import { LenderCatalogService, CATALOG_SOURCE_PORT } from './decision/catalog.service.js';
import { BASIS_CIPHER_PORT } from './decision/engine/persistence.port.js';
import { PRISMA } from './internal/tokens.js';

/**
 * OrchestrationModule wiring (P7b).
 *
 * New in P7b vs P6:
 *   • basisCipherToken — DI token (from the outer app) for the BasisCipherPort
 *     implementation. In apps/api this is PiiVaultService. Accepted as an
 *     option so orchestration never imports service-user directly, preserving
 *     the dependency boundary (ADR-0027).
 *   • DecisionPrismaRepository — Prisma-backed DecisionRepositoryPort.
 *   • LenderCatalogService — DB-backed CatalogSourcePort.
 *   • DecideController — NestJS POST /v1/decide handler.
 *
 * Existing providers (OrchestrationService, DecisionService) are unchanged;
 * World B (event-driven, live-quote routing) continues to run alongside
 * World A (catalog-only prequal) without mutual interference.
 */
export interface OrchestrationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /**
   * DI token for the BasisCipherPort — the outer app binds its PiiVaultService
   * (or any opaque-envelope cipher) here. In apps/api:
   *
   *   OrchestrationModule.forRoot({
   *     prismaToken: PrismaService,
   *     basisCipherToken: PiiVaultService,  // ← service-user dependency lives here
   *   })
   *
   * The orchestration module itself never imports service-user.
   */
  basisCipherToken: symbol | string | (abstract new (...args: never[]) => unknown);
}

@Module({})
export class OrchestrationModule {
  static forRoot(options: OrchestrationModuleOptions): DynamicModule {
    const prisma: Provider = {
      provide: PRISMA,
      useExisting: options.prismaToken as never,
    };

    const basisCipher: Provider = {
      provide: BASIS_CIPHER_PORT,
      useExisting: options.basisCipherToken as never,
    };

    const decisionRepository: Provider = {
      provide: DECISION_REPOSITORY_PORT,
      useExisting: DecisionPrismaRepository,
    };

    const catalogSource: Provider = {
      provide: CATALOG_SOURCE_PORT,
      useExisting: LenderCatalogService,
    };

    return {
      module: OrchestrationModule,
      global: true,
      controllers: [DecideController],
      providers: [
        // Infrastructure bindings
        prisma,
        basisCipher,
        // Concrete implementations (registered so useExisting can resolve them)
        DecisionPrismaRepository,
        LenderCatalogService,
        // Port→implementation aliases
        decisionRepository,
        catalogSource,
        // Legacy + existing services (World B — unchanged)
        DecisionService,
        OrchestrationService,
      ],
      exports: [OrchestrationService],
    };
  }
}
