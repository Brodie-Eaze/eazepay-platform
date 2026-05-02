import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OrchestrationService } from './orchestration.service.js';
import { DecisionService } from './decision/decision.service.js';
import { PRISMA } from './internal/tokens.js';

export interface OrchestrationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
}

@Module({})
export class OrchestrationModule {
  static forRoot(options: OrchestrationModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    return {
      module: OrchestrationModule,
      providers: [prisma, DecisionService, OrchestrationService],
      exports: [OrchestrationService],
    };
  }
}
