import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { PRISMA } from './internal/tokens.js';

export interface AdminModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
}

@Module({})
export class AdminModule {
  static forRoot(options: AdminModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    return {
      module: AdminModule,
      controllers: [AdminController, TeamController, MarketplaceController],
      providers: [
        prisma,
        Reflector,
        AdminService,
        TeamService,
        MarketplaceService,
      ],
      exports: [AdminService, TeamService, MarketplaceService],
    };
  }
}
