import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type PlatformRole, type UserStatus } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';

/**
 * Master Command Centre — team management service.
 *
 * Models EazePay staff (User.platformRole != null) and their lifecycle:
 * invite → active → disabled → closed. Consumers (platformRole = null)
 * are never returned here.
 *
 * The legacy `User.isAdmin` flag still gates the AdminGuard; we keep it
 * in sync with `platformRole` (any non-null role flips it on) so the
 * existing admin routes keep working while the partner portal moves to
 * the role-aware shape.
 */

/** Shape returned to the partner-portal Team page. Field names are kept
 *  identical to the frontend so the BFF proxy is a pass-through. */
export interface TeamMember {
  id: string;
  email: string | null;
  displayName: string | null;
  role: PlatformRole;
  /** Mapped to the partner-portal vocabulary (`active|invited|disabled`). */
  status: 'active' | 'invited' | 'disabled';
  /** ISO datetime of the last completed sign-in, null if never. */
  lastSignInAt: string | null;
  /** UserId of the admin who invited this member, null if seeded. */
  invitedBy: string | null;
  /** ISO datetime of invitation — falls back to createdAt for legacy rows. */
  invitedAt: string;
}

export interface InviteInput {
  email: string;
  displayName?: string;
  role: PlatformRole;
}

export interface UpdateInput {
  role?: PlatformRole;
  status?: 'active' | 'invited' | 'disabled';
  displayName?: string;
}

/** Partner-portal status vocabulary → DB UserStatus. */
const toDbStatus = (s: 'active' | 'invited' | 'disabled'): UserStatus => {
  if (s === 'active') return 'active';
  if (s === 'invited') return 'pending_verification';
  return 'locked';
};

/** DB UserStatus → partner-portal vocabulary. `closed` rows are not
 *  returned by the team list at all; the controller filters them out. */
const fromDbStatus = (s: UserStatus): 'active' | 'invited' | 'disabled' => {
  if (s === 'active') return 'active';
  if (s === 'pending_verification') return 'invited';
  return 'disabled';
};

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * List platform staff. Excludes `closed` (removed) accounts by default
   * so the UI table doesn't show tombstones; pass `includeClosed=true`
   * to recover them.
   */
  async list(opts: {
    cursor?: string;
    limit: number;
    filter?: 'all' | 'active' | 'invited' | 'disabled';
    includeClosed?: boolean;
  }): Promise<{ members: TeamMember[]; nextCursor: string | null }> {
    const filterStatus: UserStatus[] | undefined =
      opts.filter && opts.filter !== 'all' ? [toDbStatus(opts.filter)] : undefined;

    const items = await this.prisma.user.findMany({
      where: {
        platformRole: { not: null },
        ...(filterStatus ? { status: { in: filterStatus } } : {}),
        ...(opts.includeClosed ? {} : { status: { not: 'closed' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });

    const hasMore = items.length > opts.limit;
    const sliced = hasMore ? items.slice(0, opts.limit) : items;

    return {
      members: sliced.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.platformRole!,
        status: fromDbStatus(u.status),
        lastSignInAt: u.lastSeenAt?.toISOString() ?? null,
        invitedBy: u.invitedById,
        invitedAt: (u.invitedAt ?? u.createdAt).toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  /**
   * Invite a new staff member. Creates a User row in `pending_verification`
   * with the chosen role + a displayName, writes an audit row, and returns
   * the new row. Out-of-band notifications (invite email, OTP) are emitted
   * by the existing NotificationGateway in a follow-on round — the row is
   * the durable artefact this method guarantees.
   *
   * Idempotency: an existing User with the same email is reactivated +
   * re-roled rather than duplicated. We never return 409 for "already
   * invited" — UX-wise, re-sending the invite is what the operator wants.
   */
  async invite(actorUserId: UserId, input: InviteInput): Promise<{ member: TeamMember }> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw BadRequest({ code: 'invalid_email' });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      const now = new Date();

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              platformRole: input.role,
              isAdmin: true, // mirror legacy guard
              displayName: input.displayName ?? existing.displayName ?? null,
              status: existing.status === 'closed' ? 'pending_verification' : existing.status,
              invitedAt: existing.invitedAt ?? now,
              invitedById: existing.invitedById ?? actorUserId,
            },
          })
        : await tx.user.create({
            data: {
              email,
              displayName: input.displayName ?? null,
              status: 'pending_verification',
              platformRole: input.role,
              isAdmin: true, // legacy mirror; team invites are always staff
              invitedAt: now,
              invitedById: actorUserId,
            },
          });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: existing ? 'admin.team.reinvited' : 'admin.team.invited',
          targetType: 'User',
          targetId: user.id,
          after: { email, role: input.role, displayName: input.displayName ?? null },
        },
      });

      return {
        member: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.platformRole!,
          status: fromDbStatus(user.status),
          lastSignInAt: user.lastSeenAt?.toISOString() ?? null,
          invitedBy: user.invitedById,
          invitedAt: (user.invitedAt ?? user.createdAt).toISOString(),
        },
      };
    });
  }

  /**
   * Patch a staff member's role, status, or displayName. Status changes
   * revoke all live sessions for the user (disabling someone in the UI
   * must hard-kick them out of the platform — never a UX-only flag).
   */
  async update(
    actorUserId: UserId,
    targetUserId: string,
    input: UpdateInput,
  ): Promise<{ member: TeamMember }> {
    if (input.role === undefined && input.status === undefined && input.displayName === undefined) {
      throw BadRequest({ code: 'no_fields_to_update' });
    }
    if (targetUserId === actorUserId && input.status === 'disabled') {
      throw Conflict({ code: 'cannot_disable_self' });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!existing) throw NotFound({ code: 'user_not_found' });
      if (existing.platformRole == null) {
        throw Conflict({
          code: 'not_a_team_member',
          detail: 'target user has no platformRole — not a staff member',
        });
      }

      const data: Record<string, unknown> = {};
      if (input.role !== undefined) {
        data['platformRole'] = input.role;
        // Master admin keeps legacy isAdmin true; read-only loses it. We
        // play this conservatively: any non-null role still maps to
        // legacy admin until routes migrate off the boolean.
        data['isAdmin'] = true;
      }
      if (input.status !== undefined) {
        data['status'] = toDbStatus(input.status);
      }
      if (input.displayName !== undefined) {
        data['displayName'] = input.displayName || null;
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data,
      });

      // Hard-kick if the account just became disabled.
      if (input.status === 'disabled') {
        await tx.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: 'admin.team.updated',
          targetType: 'User',
          targetId: targetUserId,
          before: {
            role: existing.platformRole,
            status: fromDbStatus(existing.status),
            displayName: existing.displayName,
          },
          after: {
            role: updated.platformRole,
            status: fromDbStatus(updated.status),
            displayName: updated.displayName,
          },
        },
      });

      return {
        member: {
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          role: updated.platformRole!,
          status: fromDbStatus(updated.status),
          lastSignInAt: updated.lastSeenAt?.toISOString() ?? null,
          invitedBy: updated.invitedById,
          invitedAt: (updated.invitedAt ?? updated.createdAt).toISOString(),
        },
      };
    });
  }

  /**
   * Soft-remove. Sets `status=closed`, strips `platformRole` (so the
   * record drops out of team lists), and revokes all sessions. Audit
   * row recorded. We never `DELETE` here — regulators expect a
   * recoverable lineage of "who had access when".
   */
  async remove(actorUserId: UserId, targetUserId: string): Promise<{ id: string; status: 'closed' }> {
    if (targetUserId === actorUserId) {
      throw Conflict({ code: 'cannot_remove_self' });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!existing) throw NotFound({ code: 'user_not_found' });
      if (existing.platformRole == null) {
        throw Conflict({
          code: 'not_a_team_member',
          detail: 'target user has no platformRole',
        });
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          status: 'closed',
          platformRole: null,
          isAdmin: false,
        },
      });
      await tx.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: 'admin.team.removed',
          targetType: 'User',
          targetId: targetUserId,
          before: { role: existing.platformRole, status: fromDbStatus(existing.status) },
          after: { role: null, status: 'closed' },
        },
      });

      return { id: targetUserId, status: 'closed' as const };
    });
  }
}
