import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@eazepay/service-auth';
import { Idempotent } from '@eazepay/shared-utils';
import { z } from 'zod';
import type { ApplicationId, UserId } from '@eazepay/shared-types';
import { ApplicationService } from './application.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';
import type { ApplicationSnapshot } from './application.types.js';

const ListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a new draft loan application' })
  create(
    @CurrentUser() userId: UserId,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationSnapshot> {
    return this.applications.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the authenticated user`s applications (cursor-paginated)' })
  list(
    @CurrentUser() userId: UserId,
    @Query() query: Record<string, string>,
  ): Promise<{ items: ApplicationSnapshot[]; nextCursor: string | null }> {
    const parsed = ListQuerySchema.parse(query);
    return this.applications.list(userId, parsed);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one application by id' })
  getOne(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApplicationSnapshot> {
    return this.applications.getOne(userId, id as ApplicationId);
  }

  @Get(':id/offers')
  @ApiOperation({ summary: 'List offers ranked by lowest total cost to consumer' })
  offers(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.applications.listOffers(userId, id as ApplicationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft application; rejected after submission' })
  update(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationSnapshot> {
    return this.applications.update(userId, id as ApplicationId, dto);
  }

  @Post(':id/submit')
  @Idempotent()
  @ApiOperation({ summary: 'Submit a draft application for underwriting' })
  submit(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApplicationSnapshot> {
    return this.applications.submit(userId, id as ApplicationId);
  }

  @Post(':id/cancel')
  @Idempotent()
  @ApiOperation({ summary: 'Cancel an application (any non-terminal status)' })
  cancel(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApplicationSnapshot> {
    return this.applications.cancel(userId, id as ApplicationId);
  }

  @Post(':id/offers/:offerId/accept')
  @Idempotent()
  @ApiOperation({
    summary: 'Accept an offer; siblings withdrawn; e-sign envelope sent; Loan created on signed',
  })
  acceptOffer(
    @CurrentUser() userId: UserId,
    @Param('id', new ParseUUIDPipe()) applicationId: string,
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
  ): Promise<ApplicationSnapshot> {
    return this.applications.acceptOffer(userId, applicationId as ApplicationId, offerId);
  }
}
