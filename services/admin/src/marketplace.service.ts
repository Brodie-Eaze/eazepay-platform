import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { type CreditTier, type MarketplaceStatus, type ProductBrand } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';

/**
 * Master Command Centre — marketplace + per-partner access service.
 *
 * Three control planes here:
 *   1. Marketplaces (engine.tech, in-house, affiliate pools)
 *   2. MarketplaceLenders (toggleable rows inside a marketplace)
 *   3. PartnerLenderAccess (per-merchant override of a lender's
 *      availability)
 *
 * Routing rule the orchestration engine reads from this data:
 *   effectiveEnabled =
 *     PartnerLenderAccess.enabled  (if a row exists for {merchant, lender})
 *     else MarketplaceLender.globallyEnabled
 *   AND the marketplace itself is `status=active`
 *   AND the applicant's CreditTier is in `servesTiers`
 *   AND the merchant's brand is in `brands` (or `brands` is empty).
 */

export interface MarketplaceSummary {
  id: string;
  slug: string;
  legalName: string;
  displayName: string;
  provider: string;
  status: MarketplaceStatus;
  lenderCount: number;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface MarketplaceLenderRow {
  id: string;
  marketplaceId: string;
  marketplaceSlug: string;
  externalLenderId: string;
  legalName: string;
  displayName: string;
  servesTiers: CreditTier[];
  brands: ProductBrand[];
  minAmountCents: string;
  maxAmountCents: string;
  minScore: number | null;
  permittedStates: string[];
  globallyEnabled: boolean;
  syncedAt: string;
}

export interface PartnerAccessRow {
  id: string;
  merchantId: string;
  marketplaceLenderId: string;
  enabled: boolean;
  reason: string | null;
  changedById: string | null;
  changedAt: string;
  /** Inherited `globallyEnabled` value for the lender. */
  globallyEnabled: boolean;
  /** Resolved value the orchestration engine uses for routing. */
  effectiveEnabled: boolean;
  /** Denormalised display data so the UI doesn't need a second hop. */
  lender: { legalName: string; displayName: string; servesTiers: CreditTier[] };
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // ---------- Marketplaces ----------

  async listMarketplaces(): Promise<MarketplaceSummary[]> {
    const rows = await this.prisma.marketplace.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((m) => ({
      id: m.id,
      slug: m.slug,
      legalName: m.legalName,
      displayName: m.displayName,
      provider: m.provider,
      status: m.status,
      lenderCount: m.lenderCount,
      lastSyncAt: m.lastSyncAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // ---------- Marketplace lenders ----------

  async listMarketplaceLenders(opts: {
    marketplaceId?: string;
    brand?: ProductBrand;
    tier?: CreditTier;
    enabled?: boolean;
  }): Promise<MarketplaceLenderRow[]> {
    const rows = await this.prisma.marketplaceLender.findMany({
      where: {
        ...(opts.marketplaceId ? { marketplaceId: opts.marketplaceId } : {}),
        ...(opts.enabled !== undefined ? { globallyEnabled: opts.enabled } : {}),
      },
      include: { marketplace: { select: { slug: true } } },
      orderBy: { displayName: 'asc' },
    });

    // Brand / tier filtering happens post-fetch because Postgres array
    // `has` semantics on an empty allowlist (= "all brands") need
    // app-layer interpretation: empty `brands` means available to every
    // brand, NOT "available to no brand".
    return rows
      .filter((r) => {
        if (opts.brand && r.brands.length > 0 && !r.brands.includes(opts.brand)) {
          return false;
        }
        if (opts.tier && !r.servesTiers.includes(opts.tier)) {
          return false;
        }
        return true;
      })
      .map((r) => ({
        id: r.id,
        marketplaceId: r.marketplaceId,
        marketplaceSlug: r.marketplace.slug,
        externalLenderId: r.externalLenderId,
        legalName: r.legalName,
        displayName: r.displayName,
        servesTiers: r.servesTiers,
        brands: r.brands,
        minAmountCents: r.minAmountCents.toString(),
        maxAmountCents: r.maxAmountCents.toString(),
        minScore: r.minScore,
        permittedStates: r.permittedStates,
        globallyEnabled: r.globallyEnabled,
        syncedAt: r.syncedAt.toISOString(),
      }));
  }

  /**
   * Patch a marketplace lender. `globallyEnabled` is the kill switch
   * every operator reaches for; `servesTiers` + `brands` are the routing
   * filters the orchestration engine reads on every application.
   */
  async updateMarketplaceLender(
    actorUserId: UserId,
    id: string,
    input: {
      globallyEnabled?: boolean;
      servesTiers?: CreditTier[];
      brands?: ProductBrand[];
      minScore?: number | null;
      permittedStates?: string[];
    },
  ): Promise<MarketplaceLenderRow> {
    if (Object.keys(input).length === 0) {
      throw BadRequest({ code: 'no_fields_to_update' });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.marketplaceLender.findUnique({ where: { id } });
      if (!existing) throw NotFound({ code: 'marketplace_lender_not_found' });

      const updated = await tx.marketplaceLender.update({
        where: { id },
        data: {
          ...(input.globallyEnabled !== undefined
            ? { globallyEnabled: input.globallyEnabled }
            : {}),
          ...(input.servesTiers !== undefined ? { servesTiers: input.servesTiers } : {}),
          ...(input.brands !== undefined ? { brands: input.brands } : {}),
          ...(input.minScore !== undefined ? { minScore: input.minScore } : {}),
          ...(input.permittedStates !== undefined
            ? { permittedStates: input.permittedStates }
            : {}),
        },
        include: { marketplace: { select: { slug: true } } },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: 'admin.marketplace_lender.updated',
          targetType: 'MarketplaceLender',
          targetId: id,
          before: {
            globallyEnabled: existing.globallyEnabled,
            servesTiers: existing.servesTiers,
            brands: existing.brands,
            minScore: existing.minScore,
            permittedStates: existing.permittedStates,
          },
          after: {
            globallyEnabled: updated.globallyEnabled,
            servesTiers: updated.servesTiers,
            brands: updated.brands,
            minScore: updated.minScore,
            permittedStates: updated.permittedStates,
          },
        },
      });

      return {
        id: updated.id,
        marketplaceId: updated.marketplaceId,
        marketplaceSlug: updated.marketplace.slug,
        externalLenderId: updated.externalLenderId,
        legalName: updated.legalName,
        displayName: updated.displayName,
        servesTiers: updated.servesTiers,
        brands: updated.brands,
        minAmountCents: updated.minAmountCents.toString(),
        maxAmountCents: updated.maxAmountCents.toString(),
        minScore: updated.minScore,
        permittedStates: updated.permittedStates,
        globallyEnabled: updated.globallyEnabled,
        syncedAt: updated.syncedAt.toISOString(),
      };
    });
  }

  // ---------- Partner-lender access ----------

  /**
   * List per-partner access rows for a merchant, joined against the
   * underlying marketplace lender so the UI can render the full access
   * matrix without N+1 fetches. Lenders with no row default to the
   * global value — those are surfaced too, with `id=null`, so the
   * frontend can present "inherit" vs "override" uniformly.
   */
  async listPartnerAccess(merchantId: string): Promise<PartnerAccessRow[]> {
    const lenders = await this.prisma.marketplaceLender.findMany({
      include: {
        accessOverrides: { where: { merchantId } },
      },
      orderBy: { displayName: 'asc' },
    });

    return lenders.map((l) => {
      const override = l.accessOverrides[0];
      const effective = override ? override.enabled : l.globallyEnabled;
      return {
        id: override?.id ?? '',
        merchantId,
        marketplaceLenderId: l.id,
        enabled: override ? override.enabled : l.globallyEnabled,
        reason: override?.reason ?? null,
        changedById: override?.changedById ?? null,
        changedAt: (override?.changedAt ?? l.updatedAt).toISOString(),
        globallyEnabled: l.globallyEnabled,
        effectiveEnabled: effective,
        lender: {
          legalName: l.legalName,
          displayName: l.displayName,
          servesTiers: l.servesTiers,
        },
      };
    });
  }

  /**
   * Upsert a per-partner override. Two modes:
   *   - { enabled: boolean }     → set explicit override
   *   - { inherit: true }        → delete the override row, falling
   *                                back to globallyEnabled
   *
   * Each transition writes an audit row with before/after so the
   * compliance team can reconstruct who turned what on for whom.
   */
  async setPartnerAccess(
    actorUserId: UserId,
    input: {
      merchantId: string;
      marketplaceLenderId: string;
      enabled?: boolean;
      inherit?: boolean;
      reason?: string;
    },
  ): Promise<
    PartnerAccessRow | { merchantId: string; marketplaceLenderId: string; inherited: true }
  > {
    if (input.inherit && input.enabled !== undefined) {
      throw BadRequest({
        code: 'conflicting_intent',
        detail: 'pass either `enabled` OR `inherit`, never both',
      });
    }
    if (!input.inherit && input.enabled === undefined) {
      throw BadRequest({ code: 'enabled_or_inherit_required' });
    }
    return this.prisma.$transaction(async (tx) => {
      const lender = await tx.marketplaceLender.findUnique({
        where: { id: input.marketplaceLenderId },
      });
      if (!lender) throw NotFound({ code: 'marketplace_lender_not_found' });

      const merchant = await tx.merchant.findUnique({
        where: { id: input.merchantId },
        select: { id: true },
      });
      if (!merchant) throw NotFound({ code: 'merchant_not_found' });

      const existing = await tx.partnerLenderAccess.findUnique({
        where: {
          merchantId_marketplaceLenderId: {
            merchantId: input.merchantId,
            marketplaceLenderId: input.marketplaceLenderId,
          },
        },
      });

      if (input.inherit) {
        if (existing) {
          await tx.partnerLenderAccess.delete({ where: { id: existing.id } });
          await tx.auditOutbox.create({
            data: {
              actorType: 'admin',
              actorId: actorUserId,
              action: 'admin.partner_lender_access.cleared',
              targetType: 'PartnerLenderAccess',
              targetId: existing.id,
              before: { enabled: existing.enabled, reason: existing.reason },
              after: { inherited: true, globallyEnabled: lender.globallyEnabled },
            },
          });
        }
        return {
          merchantId: input.merchantId,
          marketplaceLenderId: input.marketplaceLenderId,
          inherited: true as const,
        };
      }

      const upserted = await tx.partnerLenderAccess.upsert({
        where: {
          merchantId_marketplaceLenderId: {
            merchantId: input.merchantId,
            marketplaceLenderId: input.marketplaceLenderId,
          },
        },
        create: {
          merchantId: input.merchantId,
          marketplaceLenderId: input.marketplaceLenderId,
          enabled: input.enabled!,
          reason: input.reason ?? null,
          changedById: actorUserId,
        },
        update: {
          enabled: input.enabled!,
          reason: input.reason ?? null,
          changedById: actorUserId,
          changedAt: new Date(),
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: existing
            ? 'admin.partner_lender_access.updated'
            : 'admin.partner_lender_access.created',
          targetType: 'PartnerLenderAccess',
          targetId: upserted.id,
          before: existing
            ? { enabled: existing.enabled, reason: existing.reason }
            : { inherited: true, globallyEnabled: lender.globallyEnabled },
          after: { enabled: upserted.enabled, reason: upserted.reason },
        },
      });

      return {
        id: upserted.id,
        merchantId: upserted.merchantId,
        marketplaceLenderId: upserted.marketplaceLenderId,
        enabled: upserted.enabled,
        reason: upserted.reason,
        changedById: upserted.changedById,
        changedAt: upserted.changedAt.toISOString(),
        globallyEnabled: lender.globallyEnabled,
        effectiveEnabled: upserted.enabled,
        lender: {
          legalName: lender.legalName,
          displayName: lender.displayName,
          servesTiers: lender.servesTiers,
        },
      };
    });
  }
}
