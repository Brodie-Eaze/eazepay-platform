import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { BadRequest, Conflict, Forbidden, NotFound, sha256Hex } from '@eazepay/shared-utils';
import { PiiVaultService } from '@eazepay/service-user';
import type { MerchantId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { webhookSecretAadContext } from './internal/webhook-signing.js';
import type {
  WebhookPublishInput,
  WebhookPublisher,
} from './ports/webhook-publisher.port.js';

const SECRET_BYTES = 32;
const MAX_ENDPOINT_EVENTS = 50;
const ALLOWED_PROTOCOLS = new Set(['https:']);
// Hostnames blocked by direct string match. Also caught by the IP-range
// checks below once resolved — kept as an explicit allowlist short-circuit.
const PROD_REJECT_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

/**
 * SSRF block ranges (SEC-004). Any outbound webhook URL whose hostname
 * resolves to one of these ranges is rejected with `endpoint_url_blocked`.
 *
 * Attack scenarios closed:
 *   • Cloud metadata harvest — `169.254.169.254` is the AWS / GCP /
 *     Azure IMDS endpoint that returns IAM credentials. A merchant
 *     who can register a webhook pointed there could trivially exfil
 *     our worker's IAM role.
 *   • Internal LAN probing — RFC1918 ranges (10/8, 172.16/12,
 *     192.168/16) reach internal services (databases, admin panels,
 *     unauthenticated dashboards) from inside our worker network.
 *   • IPv6 equivalents — loopback `::1`, link-local `fe80::/10`,
 *     unique-local `fc00::/7`, and IPv4-mapped IPv6 (`::ffff:10.0.0.0`)
 *     which trivially bypasses an IPv4-only blocklist.
 *   • Broadcast / multicast / unspecified — `0.0.0.0`,
 *     `255.255.255.255`, and `224.0.0.0/4` can do strange things on
 *     misconfigured networks.
 *
 * KNOWN LIMITATION (deferred — see SEC-004 follow-up): DNS rebinding.
 * We resolve the hostname at registration time and (separately) at
 * dispatch time, but the resolver answer can change between those
 * resolutions and the actual TCP connect. A complete fix requires
 * resolving once and then pinning the dispatcher's HTTP connection to
 * that exact IP — likely a custom `lookup` in the dispatcher's
 * `node:https` agent. Tracked for the dispatcher service hardening.
 */
const IPV4_BLOCK_CIDRS: Array<[number, number]> = [
  [ipv4ToInt('0.0.0.0'), 8],         // 0.0.0.0/8 (this network, incl. 0.0.0.0)
  [ipv4ToInt('10.0.0.0'), 8],        // RFC1918
  [ipv4ToInt('100.64.0.0'), 10],     // CGNAT
  [ipv4ToInt('127.0.0.0'), 8],       // loopback
  [ipv4ToInt('169.254.0.0'), 16],    // link-local incl. IMDS 169.254.169.254
  [ipv4ToInt('172.16.0.0'), 12],     // RFC1918
  [ipv4ToInt('192.0.0.0'), 24],      // IETF protocol assignments
  [ipv4ToInt('192.0.2.0'), 24],      // TEST-NET-1
  [ipv4ToInt('192.168.0.0'), 16],    // RFC1918
  [ipv4ToInt('198.18.0.0'), 15],     // benchmark
  [ipv4ToInt('198.51.100.0'), 24],   // TEST-NET-2
  [ipv4ToInt('203.0.113.0'), 24],    // TEST-NET-3
  [ipv4ToInt('224.0.0.0'), 4],       // multicast
  [ipv4ToInt('240.0.0.0'), 4],       // reserved (covers 255.255.255.255)
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  // eslint-disable-next-line no-bitwise
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function ipv4InBlockedRange(ip: string): boolean {
  const n = ipv4ToInt(ip);
  for (const [net, prefix] of IPV4_BLOCK_CIDRS) {
    // eslint-disable-next-line no-bitwise
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    // eslint-disable-next-line no-bitwise
    if ((n & mask) === (net & mask)) return true;
  }
  return false;
}

function ipv6IsBlocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check via IPv4 ranges so a
  // mapped 10.x or 169.254.x is blocked the same as bare IPv4.
  const mappedMatch = lower.match(/^::ffff:([0-9a-f.:]+)$/);
  if (mappedMatch) {
    const inner = mappedMatch[1]!;
    if (isIP(inner) === 4) return ipv4InBlockedRange(inner);
  }
  // fe80::/10 — link-local
  if (/^fe[89ab][0-9a-f]?:/.test(lower)) return true;
  // fc00::/7 — unique-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // ff00::/8 — multicast
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  return false;
}

/**
 * Resolve `host` via DNS and check every returned address against the
 * block ranges. Returns `null` if the host is safe, or a reason string
 * if it should be rejected. Failure to resolve also returns a reason
 * — better to reject than to ship a URL we cannot verify.
 *
 * Best-effort only. See the DNS-rebinding note on IPV4_BLOCK_CIDRS for
 * the gap this does not close.
 */
async function isPrivateOrReservedHost(host: string): Promise<string | null> {
  const literal = isIP(host);
  if (literal === 4) {
    return ipv4InBlockedRange(host) ? `host ${host} is a blocked IPv4 range` : null;
  }
  if (literal === 6) {
    return ipv6IsBlocked(host) ? `host ${host} is a blocked IPv6 range` : null;
  }

  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    return `host ${host} failed to resolve (${(err as Error).message})`;
  }
  for (const a of addrs) {
    if (a.family === 4 && ipv4InBlockedRange(a.address)) {
      return `host ${host} resolves to blocked IPv4 ${a.address}`;
    }
    if (a.family === 6 && ipv6IsBlocked(a.address)) {
      return `host ${host} resolves to blocked IPv6 ${a.address}`;
    }
  }
  return null;
}

@Injectable()
export class WebhookService implements WebhookPublisher {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
  ) {}

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
    await this.validateUrl(input.url);

    const secret = `whsec_${randomBytes(SECRET_BYTES).toString('base64url')}`;
    const secretHash = sha256Hex(secret);
    // Generate the row id up front so the sealed-secret AAD can bind to
    // this specific endpoint before the row exists. Sealing outside the
    // transaction means we don't hold a DB connection open for the KMS
    // round-trip.
    const endpointId = randomUUID();
    const secretCiphertext = await this.vault.sealOpaque(
      secret,
      webhookSecretAadContext(endpointId),
    );

    const endpoint = await this.prisma.$transaction(async (tx) => {
      const e = await tx.webhookEndpoint.create({
        data: {
          id: endpointId,
          merchantId,
          url: input.url,
          secretHash,
          secretCiphertext,
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
    // AAD is bound to the endpoint id (not the secret value) so rotation
    // keeps reusing the same AAD context — the only things that change
    // are the inner plaintext, the DEK, and the GCM nonce.
    const secretCiphertext = await this.vault.sealOpaque(
      secret,
      webhookSecretAadContext(endpointId),
    );
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
        data: { secretHash, secretCiphertext, consecutiveFailures: 0 },
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
    // SEC-021: webhook deliveries can leak event payloads — including
    // application metadata, lender-of-record, offer pricing, contract
    // ids — to anyone who can read them. Tightened to manager-only so
    // a merchant developer with bare `member` role can't pull the
    // delivery log from another merchant's webhook setup or from
    // their own merchant outside of the manager-scoped surfaces.
    await this.assertMerchantManager(actorUserId, merchantId);
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

  /**
   * SEC-004: SSRF defence on outbound webhook URLs.
   *
   * In addition to the existing protocol + loopback-string check, we
   * now DNS-resolve the host and reject if any address lands in a
   * reserved / private / link-local / multicast range. This is the
   * fix for the prior allowlist gap that left AWS IMDS
   * (169.254.169.254), RFC1918 LAN, and IPv6 equivalents reachable.
   *
   * The literal-string `PROD_REJECT_HOSTS` check is preserved only as
   * a fast-path / clear-error case; the IP-range check is the actual
   * security boundary and is enforced in every environment.
   */
  private async validateUrl(raw: string): Promise<void> {
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
    // URL hostname can come back wrapped in [] for IPv6 — strip for
    // both the literal-host check and DNS resolution.
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (
      process.env.NODE_ENV === 'production' &&
      PROD_REJECT_HOSTS.includes(host)
    ) {
      throw BadRequest({
        code: 'endpoint_url_blocked',
        detail: 'loopback hosts not permitted in production',
      });
    }
    const blockedReason = await isPrivateOrReservedHost(host);
    if (blockedReason) {
      throw BadRequest({
        code: 'endpoint_url_blocked',
        detail: blockedReason,
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
