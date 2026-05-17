import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import type { TeamService } from './team.service.js';

const PlatformRoleEnum = z.enum([
  'master_admin',
  'admin',
  'underwriter',
  'compliance',
  'support',
  'read_only',
]);

const StatusEnum = z.enum(['active', 'invited', 'disabled']);

const ListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  filter: z.enum(['all', 'active', 'invited', 'disabled']).default('all'),
});

const InviteSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(1).max(120).optional(),
  role: PlatformRoleEnum,
});
class InviteDto extends createZodDto(InviteSchema) {}

const UpdateSchema = z
  .object({
    role: PlatformRoleEnum.optional(),
    status: StatusEnum.optional(),
    displayName: z.string().max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field is required',
  });
class UpdateDto extends createZodDto(UpdateSchema) {}

/**
 * Master Command Centre — Team management.
 *
 * Surfaces the team-page CRUD the partner portal expects:
 *   GET    /v1/admin/team
 *   POST   /v1/admin/team        (invite)
 *   PATCH  /v1/admin/team/:id    (role | status | displayName)
 *   DELETE /v1/admin/team/:id    (soft remove)
 *
 * Sits under the same AdminGuard as the rest of /v1/admin/*; the legacy
 * `isAdmin` boolean still gates it while we migrate to role-aware checks.
 */
@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AdminGuard)
@Controller('admin/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List EazePay platform staff (filterable by status)' })
  list(
    @CurrentUser() _adminUserId: UserId,
    @Query() raw: Record<string, string>,
  ): Promise<unknown> {
    const q = ListQuerySchema.parse(raw);
    return this.team.list({
      cursor: q.cursor,
      limit: q.limit,
      filter: q.filter,
    });
  }

  @Post()
  @HttpCode(201)
  @Idempotent()
  @ApiOperation({
    summary: 'Invite a new staff member (or re-invite an existing closed account)',
  })
  invite(@CurrentUser() adminUserId: UserId, @Body() dto: InviteDto): Promise<unknown> {
    return this.team.invite(adminUserId, {
      email: dto.email,
      displayName: dto.displayName,
      role: dto.role,
    });
  }

  @Patch(':id')
  @Idempotent()
  @ApiOperation({
    summary:
      'Update a staff member: role, status (active|invited|disabled), or displayName. Disabling revokes all live sessions.',
  })
  update(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDto,
  ): Promise<unknown> {
    return this.team.update(adminUserId, id, {
      role: dto.role,
      status: dto.status,
      displayName: dto.displayName,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-remove a staff member. Sets status=closed and revokes sessions.',
  })
  remove(
    @CurrentUser() adminUserId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.team.remove(adminUserId, id);
  }
}
