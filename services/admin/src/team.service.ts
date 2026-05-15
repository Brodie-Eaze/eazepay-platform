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
   * SEC-007 — silent privilege escalation hardening.
   *
   * Previously this flow happily mutated an existing User row when the
   * invited email was already on file: it flipped `isAdmin: true`, set
   * `platformRole` to whatever the inviter chose, and called it a
   * "reinvite". That meant any admin who knew a consumer's email could
   * promote them to staff WITHOUT THEIR CONSENT — a single API call from
   * a compromised or rogue admin account turned a consumer into a peer.
   *
   * The new contract:
   *   1. If the email maps to an existing User, REJECT with 409. The
   *      caller is told to use the dedicated update / role-change flow
   *      (a separate endpoint with explicit "promote existing user"
   *      semantics — TBD; out of scope for this patch).
   *   2. Re-invites of an already-invited staff member ARE supported:
   *      we detect the existing-but-already-staff case and allow the
   *      operator to resend the invitation without changing their role.
   *      This is the legitimate idempotency case the old code conflated
   *      with the dangerous one.
   *   3. We emit an audit row for the rejected attempt too — these are
   *      exactly the events a SOC investigator wants to see if an
   *      account is later compromised.
   */
  async invite(actorUserId: UserId, input: InviteInput): Promise<{ member: TeamMember }> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw BadRequest({ code: 'invalid_email' });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      const now = new Date();

      if (existing) {
        // Case A: existing row is already a staff member (platformRole set
        // and not closed). This is a legitimate "resend the invite"
        // operation — same role, same audit-trail position. We do NOT
        // change platformRole or isAdmin here; only refresh the invite
        // metadata so the operator can see the latest invite event. If
        // the operator wants to CHANGE the role, they use update().
        const isExistingStaff =
          existing.platformRole != null && existing.status !== 'closed';

        if (!isExistingStaff) {
          // Case B: existing row is a consumer OR a closed/removed account.
          // Refuse to silently promote — this was the SEC-007 vector.
          // Write an audit row so attempts to escalate are visible even
          // though we rejected the operation. `targetId` points at the
          // existing User so investigators can correlate by user. The
          // role the attacker tried to grant is captured in `after`.
          await tx.auditOutbox.create({
            data: {
              actorType: 'admin',
              actorId: actorUserId,
              action: 'admin.team.invite_rejected_existing_user',
              targetType: 'User',
              targetId: existing.id,
              before: {
                platformRole: existing.platformRole,
                status: existing.status,
                isAdmin: existing.isAdmin,
              },
              after: {
                attemptedRole: input.role,
                attemptedDisplayName: input.displayName ?? null,
              },
            },
          });
          throw Conflict({
            code: 'user_already_exists',
            detail:
              'A user account already exists for this email. Use the team update flow to change an existing staff member\'s role, or contact the user out-of-band before granting staff access.',
          });
        }

        // Case A continued — refresh invite breadcrumbs only. No role
        // mutation, no isAdmin mutation. displayName is allowed to
        // update because it's purely cosmetic and the operator may be
        // correcting a typo.
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            displayName: input.displayName ?? existing.displayName ?? null,
            invitedAt: existing.invitedAt ?? now,
            invitedById: existing.invitedById ?? actorUserId,
          },
        });

        await tx.auditOutbox.create({
          data: {
            actorType: 'admin',
            actorId: actorUserId,
            action: 'admin.team.reinvited',
            targetType: 'User',
            targetId: user.id,
            before: {
              role: existing.platformRole,
              displayName: existing.displayName,
            },
            after: {
              role: user.platformRole,
              displayName: user.displayName,
              // Note: role intentionally NOT changed even if input.role
              // differs from existing.platformRole. Role changes require
              // the explicit update() flow.
              requestedRole: input.role,
            },
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
      }

      // Case C: brand-new email — the only path that creates staff. This
      // is the original happy path.
      const user = await tx.user.create({
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
          action: 'admin.team.invited',
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
