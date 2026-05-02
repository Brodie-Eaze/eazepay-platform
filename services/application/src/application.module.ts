import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ApplicationController } from './application.controller.js';
import { ApplicationService } from './application.service.js';
import { PRISMA } from './internal/tokens.js';

export interface ApplicationModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
}

@Module({})
export class ApplicationModule {
  static forRoot(options: ApplicationModuleOptions): DynamicModule {
    const prisma: Provider = {
      provide: PRISMA,
      useExisting: options.prismaToken as never,
    };
    return {
      module: ApplicationModule,
      controllers: [ApplicationController],
      providers: [prisma, ApplicationService],
      exports: [ApplicationService],
    };
  }
}
