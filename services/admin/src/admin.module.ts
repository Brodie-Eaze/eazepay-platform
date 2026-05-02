import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
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
      controllers: [AdminController],
      providers: [prisma, AdminService],
      exports: [AdminService],
    };
  }
}
