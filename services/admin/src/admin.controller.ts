import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard, AdminOnly, CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AdminService } from './admin.service.js';
import { ADVERSE_ACTION_REASON_CODES } from './reason-codes.js';

const ApplicationStatusEnum = z.enum([
  'draft',
  'submitted',
  'underwriting',
  'offers_presented',
  'accepted',
  'contracted',
  'funding',
  'active',
  'declined',
  'cancelled',
  'expired',
]);

const QueueQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z
    .union([ApplicationStatusEnum, z.array(ApplicationStatusEnum)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  riskRecommendation: z.enum(['accept', 'manual_review', 'decline']).optional(),
});

const AuditQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  targetType: z.string().min(1).max(50).optional(),
  targetId: z.string().min(1).max(50).optional(),
  actionPrefix: z.string().min(1).max(80).optional(),
  actorId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
});

const FlagQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

/**
 * Admin / ops console API. All routes are bearer-authed (global
 * JwtAuthGuard) AND admin-gated (per-controller AdminGuard).
 *
 * Read-only at this stage: no approve / decline / waive — those land in
 * the next round once dual-control + reason-code taxonomy enforcement
 * are in place.
 */
@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('applications')
  @ApiOperation({ summary: 'Application queue (filterable by status + risk recommendation)' })
  applicationQueue(
    // CurrentUser is required to identify the admin actor for downstream
    // audit; the guard already verified isAdmin.
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string | string[]>,
  ): Promise<unknown> {
    const q = QueueQuerySchema.parse(raw);
    return this.admin.listApplicationQueue({
      status: q.status,
      riskRecommendation: q.riskRecommendation,
      paging: { cursor: q.cursor, limit: q.limit },
    });
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Full admin view of one application (offers, routes, risk, flags)' })
  applicationDetail(
    @CurrentUser() _adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.admin.getApplicationDetail(id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit log viewer (cursor-paginated, filterable)' })
  auditLogs(
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string>,
  ): Promise<unknown> {
    const q = AuditQuerySchema.parse(raw);
    return this.admin.listAuditLogs({
      targetType: q.targetType,
      targetId: q.targetId,
      actionPrefix: q.actionPrefix,
      actorId: q.actorId,
      sinceIso: q.since,
      paging: { cursor: q.cursor, limit: q.limit },
    });
  }

  @Get('risk-flags')
  @ApiOperation({ summary: 'Open risk flags, optionally filtered by minimum severity' })
  riskFlags(
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string>,
  ): Promise<unknown> {
    const q = FlagQuerySchema.parse(raw);
    return this.admin.listOpenRiskFlags({
      minSeverity: q.minSeverity,
      paging: { cursor: q.cursor, limit: q.limit },
    });
  }

  // ----------------- mutations -----------------

  @Post('applications/:id/decline')
  @Idempotent()
  @ApiOperation({
    summary:
      'Admin decline override. Reason codes must be from the Reg B / FCRA taxonomy. Amount >= $25k opens a dual-control compliance review.',
  })
  declineApplication(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: DeclineApplicationDto,
  ): Promise<unknown> {
    return this.admin.declineApplication(adminUserId, applicationId, dto);
  }

  @Post('compliance-reviews/:id/close')
  @Idempotent()
  @ApiOperation({
    summary:
      'Close a pending-dual-control compliance review. The closer MUST differ from the creator.',
  })
  closeComplianceReview(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CloseComplianceReviewDto,
  ): Promise<unknown> {
    return this.admin.closeComplianceReview(adminUserId, id, dto);
  }

  @Post('risk-flags/:id/resolve')
  @Idempotent()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a risk flag resolved (confirmed or cleared)' })
  resolveRiskFlag(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveRiskFlagDto,
  ): Promise<unknown> {
    return this.admin.resolveRiskFlag(adminUserId, id, dto);
  }

  // -------------------- JIT PII unmask --------------------

  @Post('pii-unmask-requests')
  @Idempotent()
  @ApiOperation({
    summary:
      'Request JIT unmask of specific PII fields. Status starts at pending_approval; second admin must approve.',
  })
  requestPiiUnmask(
    @CurrentUser() adminUserId: UserId,
    @Body() dto: RequestPiiUnmaskDto,
  ): Promise<unknown> {
    return this.admin.requestPiiUnmask(adminUserId, dto);
  }

  @Post('pii-unmask-requests/:id/approve')
  @Idempotent()
  @ApiOperation({
    summary:
      'Approve a PII unmask request. Approver MUST differ from requester. Sets a time-boxed expiry.',
  })
  approvePiiUnmask(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApprovePiiUnmaskDto,
  ): Promise<unknown> {
    return this.admin.approvePiiUnmask(adminUserId, id, dto);
  }

  @Post('pii-unmask-requests/:id/revoke')
  @Idempotent()
  @ApiOperation({ summary: 'Revoke an unmask request (irreversible)' })
  revokePiiUnmask(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.admin.revokePiiUnmask(adminUserId, id);
  }

  @Get('pii-unmask-requests/:id/read')
  @ApiOperation({
    summary:
      'Read decrypted PII fields authorised by this approved unmask request. Each read writes a separate audit row.',
  })
  readUnmaskedProfile(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.admin.readUnmaskedProfile(adminUserId, id);
  }
}

// ---------- DTOs ----------

const DeclineApplicationSchema = z.object({
  reasonCodes: z
    .array(
      z
        .string()
        .refine(
          (s) => s in ADVERSE_ACTION_REASON_CODES,
          'must be a code from ADVERSE_ACTION_REASON_CODES',
        ),
    )
    .min(1)
    .max(8),
  notes: z.string().max(2000).optional(),
});
class DeclineApplicationDto extends createZodDto(DeclineApplicationSchema) {}

const CloseComplianceReviewSchema = z.object({
  outcome: z.enum([
    'closed_approved',
    'closed_declined',
    'closed_no_action',
    'escalated_reportable',
  ]),
  notes: z.string().max(2000).optional(),
  /** Required when outcome is 'escalated_reportable' (FinCEN SAR id, etc.). */
  reportableMatterRef: z.string().max(200).optional(),
}).refine(
  (v) => v.outcome !== 'escalated_reportable' || !!v.reportableMatterRef,
  { message: 'reportableMatterRef is required for escalated_reportable', path: ['reportableMatterRef'] },
);
class CloseComplianceReviewDto extends createZodDto(CloseComplianceReviewSchema) {}

const ResolveRiskFlagSchema = z.object({
  resolution: z.enum(['confirmed', 'cleared']),
  notes: z.string().max(2000).optional(),
});
class ResolveRiskFlagDto extends createZodDto(ResolveRiskFlagSchema) {}

const ALLOWED_UNMASK_FIELD_VALUES = [
  'legalName.first',
  'legalName.middle',
  'legalName.last',
  'dateOfBirth',
  'ssnLast4',
  'address.line1',
  'address.line2',
  'address.city',
  'address.state',
  'address.zip',
] as const;

const RequestPiiUnmaskSchema = z.object({
  subjectType: z.enum(['User', 'BeneficialOwner']),
  subjectId: z.string().uuid(),
  fields: z.array(z.enum(ALLOWED_UNMASK_FIELD_VALUES)).min(1).max(ALLOWED_UNMASK_FIELD_VALUES.length),
  reasonCode: z.enum([
    'manual_underwriting_review',
    'fraud_investigation',
    'customer_service_request',
    'compliance_review',
    'legal_request',
    'reportable_matter_filing',
    'notice_re_render',
  ]),
  reasonNotes: z.string().min(10).max(2000),
  ttlSeconds: z.number().int().min(60).max(3600).optional(),
});
class RequestPiiUnmaskDto extends createZodDto(RequestPiiUnmaskSchema) {}

const ApprovePiiUnmaskSchema = z.object({
  ttlSeconds: z.number().int().min(60).max(3600).optional(),
});
class ApprovePiiUnmaskDto extends createZodDto(ApprovePiiUnmaskSchema) {}
