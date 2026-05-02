import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { BadRequest, Conflict, Forbidden, NotFound, sha256Hex } from '@eazepay/shared-utils';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import type {
  WebhookPublishInput,
  WebhookPublisher,
} from './ports/webhook-publisher.port.js';

const SECRET_BYTES = 32;
const MAX_ENDPOINT_EVENTS = 50;
const ALLOWED_PROTOCOLS = new Set(['https:']);
const PROD_REJECT_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

@Injectable()
export class WebhookService implements WebhookPublisher {
  private readonly logger = new Logger(WebhookService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // ----------------- Endpoint CRUD -----------------

  async createEndpoint(
    actorUserId: UserId,
    merchantId: MerchantId,
    input: { url: string; events: string[]; description?: string },
  ): Promise<{
    id: string;
    /** Returned ONCE at creation. Hash-stored thereafter. */
    secret: string;
    url: string;
    events: string[];
  }> {
    await this.assertMerchantManager(actorUserId, merchantId);

    if (!input.events || input.events.length === 0) {
      throw BadRequest({ code: 'events_required' });
    }
    if (input.events.length > MAX_ENDPOINT_EVENTS) {
      throw BadRequest({
        code: 'too_many_events',
        detail: `max ${MAX_ENDPOINT_EVENTS}`,
      });
    }
    this.validateUrl(input.url);

    const secret = `whsec_${randomBytes(SECRET_BYTES).toString('base64url')}`;
    const secretHash = sha256Hex(secret);

    const endpoint = await this.prisma.$transaction(async (tx) => {
      const e = await tx.webhookEndpoint.create({
        data: {
          merchantId,
          url: input.url,
          secretHash,
          events: input.events,
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
        select: { id: true, url: true, events: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: actorUserId,
          action: 'merchant.webhook.endpoint.created',
          targetType: 'WebhookEndpoint',
          targetId: e.id,
          after: { merchantId, url: input.url, events: input.events },
        },
      });
      return e;
    });

    return {
      id: endpoint.id,
      secret,
      url: endpoint.url,
      events: endpoint.events,
    };
  }

  async listEndpoints(
    actorUserId: UserId,
    merchantId: MerchantId,
  ): Promise<Array<{
    id: string;
    url: string;
    events: string[];
    status: string;
    description: string | null;
    lastDeliveredAt: string | null;
    consecutiveFailures: number;
    createdAt: string;
  }>> {
    await this.assertMerchantMember(actorUserId, merchantId);
    const rows = await this.prisma.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      events: r.events,
      status: r.status,
      description: r.description,
      lastDeliveredAt: r.lastDeliveredAt?.toISOString() ?? null,
      consecutiveFailures: r.consecutiveFailures,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async revokeEndpoint(
    actorUserId: UserId,
    merchantId: MerchantId,
    endpointId: string,
  ): Promise<void> {
    await this.assertMerchantManager(actorUserId, merchantId);
    return this.prisma.$transaction(async (tx) => {
      const ep = await tx.webhookEndpoint.findFirst({
        where: { id: endpointId, merchantId },
      });
      if (!ep) throw NotFound({ code: 'webhook_endpoint_not_found' });
      await tx.webhookEndpoint.update({
        where: { id: endpointId },
        data: { status: 'revoked' },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: actorUserId,
          action: 'merchant.webhook.endpoint.revoked',
          targetType: 'WebhookEndpoint',
          targetId: endpointId,
        },
      });
    });
  }

  async rotateSecret(
    actorUserId: UserId,
    merchantId: MerchantId,
    endpointId: string,
  ): Promise<{ secret: string }> {
    await this.assertMerchantManager(actorUserId, merchantId);
    const secret = `whsec_${randomBytes(SECRET_BYTES).toString('base64url')}`;
    const secretHash = sha256Hex(secret);
    await this.prisma.$transaction(async (tx) => {
      const ep = await tx.webhookEndpoint.findFirst({
        where: { id: endpointId, merchantId },
      });
      if (!ep) throw NotFound({ code: 'webhook_endpoint_not_found' });
      if (ep.status === 'revoked') {
        throw Conflict({ code: 'webhook_endpoint_revoked' });
      }
      await tx.webhookEndpoint.update({
        where: { id: endpointId },
        data: { secretHash, consecutiveFailures: 0 },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: actorUserId,
          action: 'merchant.webhook.endpoint.secret_rotated',
          targetType: 'WebhookEndpoint',
          targetId: endpointId,
        },
      });
    });
    return { secret };
  }

  async listDeliveries(
    actorUserId: UserId,
    merchantId: MerchantId,
    endpointId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<unknown> {
    await this.assertMerchantMember(actorUserId, merchantId);
    const ep = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, merchantId },
      select: { id: true },
    });
    if (!ep) throw NotFound({ code: 'webhook_endpoint_not_found' });

    const items = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });
    const hasMore = items.length > opts.limit;
    const sliced = hasMore ? items.slice(0, opts.limit) : items;
    return {
      items: sliced.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        eventId: d.eventId,
        status: d.status,
        attempts: d.attempts,
        lastStatusCode: d.lastStatusCode,
        lastError: d.lastError,
        nextAttemptAt: d.nextAttemptAt?.toISOString() ?? null,
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  async retryDelivery(
    actorUserId: UserId,
    merchantId: MerchantId,
    deliveryId: string,
  ): Promise<{ id: string; status: string }> {
    await this.assertMerchantManager(actorUserId, merchantId);
    const d = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: { select: { merchantId: true } } },
    });
    if (!d || d.endpoint.merchantId !== merchantId) {
      throw NotFound({ code: 'webhook_delivery_not_found' });
    }
    if (d.status === 'delivered') {
      throw Conflict({ code: 'webhook_delivery_already_delivered' });
    }
    const updated = await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        nextAttemptAt: new Date(),
      },
      select: { id: true, status: true },
    });
    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: actorUserId,
        action: 'merchant.webhook.delivery.retry_requested',
        targetType: 'WebhookDelivery',
        targetId: deliveryId,
      },
    });
    return updated;
  }

  // ----------------- Publish -----------------

  async publish(input: WebhookPublishInput): Promise<{ deliveriesCreated: number }> {
    if (!input.eventType || !input.eventId) {
      throw BadRequest({ code: 'event_type_and_id_required' });
    }
    if (!input.merchantId) {
      // Fan-out-to-all is reserved; return a no-op rather than scanning
      // every endpoint until we have a real use case.
      return { deliveriesCreated: 0 };
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        merchantId: input.merchantId,
        status: 'active',
        events: { has: input.eventType },
      },
      select: { id: true },
    });
    if (endpoints.length === 0) return { deliveriesCreated: 0 };

    let created = 0;
    for (const ep of endpoints) {
      try {
        await this.prisma.webhookDelivery.create({
          data: {
            endpointId: ep.id,
            eventType: input.eventType,
            eventId: input.eventId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            payload: input.payload as object,
            status: 'pending',
            nextAttemptAt: new Date(),
          },
        });
        created++;
      } catch (err) {
        // P2002 on (endpointId, eventId) means we've already enqueued
        // this exact event for this endpoint — treat as a no-op.
        if (
          typeof err === 'object' &&
          err !== null &&
          (err as { code?: string }).code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    return { deliveriesCreated: created };
  }

  // ----------------- helpers -----------------

  private validateUrl(raw: string): void {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw BadRequest({ code: 'url_invalid' });
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw BadRequest({
        code: 'url_protocol_not_allowed',
        detail: 'webhook urls must be https',
      });
    }
    if (
      process.env.NODE_ENV === 'production' &&
      PROD_REJECT_HOSTS.includes(parsed.hostname)
    ) {
      throw BadRequest({
        code: 'url_loopback_in_production',
        detail: 'loopback hosts not permitted in production',
      });
    }
  }

  private async assertMerchantMember(userId: UserId, merchantId: MerchantId): Promise<void> {
    const link = await this.prisma.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
    });
    if (!link) throw NotFound({ code: 'merchant_not_found' });
  }

  private async assertMerchantManager(userId: UserId, merchantId: MerchantId): Promise<void> {
    const link = await this.prisma.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
    });
    if (!link) throw NotFound({ code: 'merchant_not_found' });
    if (link.role === 'read_only' || link.role === 'staff') {
      throw Forbidden({ code: 'insufficient_role', detail: `role=${link.role}` });
    }
  }
}
