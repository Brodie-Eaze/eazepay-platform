import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ComplianceDocService } from './compliance-doc.service.js';
import { COMPLIANCE_DOC_BUCKET, PRISMA } from './internal/tokens.js';

export interface ComplianceDocModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Object storage bucket id where rendered notices land. */
  bucket: string;
}

@Module({})
export class ComplianceDocModule {
  static forRoot(options: ComplianceDocModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    const bucket: Provider = { provide: COMPLIANCE_DOC_BUCKET, useValue: options.bucket };
    return {
      module: ComplianceDocModule,
      // Global so admin / application services can fire generation
      // without re-importing config.
      global: true,
      providers: [prisma, bucket, ComplianceDocService],
      exports: [ComplianceDocService],
    };
  }
}
