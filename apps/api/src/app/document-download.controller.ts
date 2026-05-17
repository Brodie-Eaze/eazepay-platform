import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@eazepay/service-auth';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { Forbidden } from '@eazepay/shared-utils';
import type { ComplianceDocService } from '@eazepay/service-compliance-doc';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Consumer-facing document download. Restricted: a user can only see
 * documents whose ownerType+ownerId trace back to them. We resolve the
 * Application via Prisma + match userId before issuing a presigned URL.
 *
 * The Adverse Action Notice is the most-fetched document at MVP; this
 * controller's surface generalises trivially when other consumer-facing
 * documents (loan agreement, payoff quote, payment-assistance letter)
 * land.
 */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('me/applications')
export class ConsumerDocumentDownloadController {
  constructor(
    private readonly compliance: ComplianceDocService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/adverse-action-notice')
  @ApiOperation({
    summary: 'Presigned download URL for this application`s Adverse Action Notice (15-min TTL)',
  })
  async getNotice(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    // Authorisation: confirm the application belongs to the caller.
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!app) throw Forbidden({ code: 'application_not_owned' });
    const notice = await this.compliance.findAdverseActionForApplication(id as ApplicationId);
    if (!notice) {
      // Not yet generated — treat as 404-ish via Forbidden so we don't
      // disclose document existence beyond the user's own scope.
      throw Forbidden({ code: 'notice_not_available' });
    }
    return this.compliance.presignedDownloadUrl(notice.id);
  }
}
