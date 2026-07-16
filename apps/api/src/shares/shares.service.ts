import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { shareCredentialSchema, shareCredentialWithGroupSchema } from "@vaultops/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { isOrgWideRole } from "../rbac/permissions";
import { RbacService } from "../rbac/rbac.service";

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  private async isShareAdmin(userId: string, organizationId: string) {
    const names = await this.rbac.userRoleNames(userId, organizationId);
    return names.some((n) => isOrgWideRole(n));
  }

  private async assertCanAccessCredential(credentialId: string, user: RequestUser) {
    const row = await this.prisma.credential.findFirst({
      where: { id: credentialId, organizationId: user.organizationId },
    });
    if (!row) {
      throw new NotFoundException("Credential not found");
    }
    const seeAll = await this.rbac.canSeeAllOrgCredentials(
      user.internalUserId,
      user.organizationId,
    );
    if (seeAll || row.createdById === user.internalUserId) {
      return row;
    }
    const shared = await this.prisma.credentialShare.findUnique({
      where: {
        credentialId_userId: { credentialId, userId: user.internalUserId },
      },
    });
    if (shared) {
      return row;
    }
    const sharedViaGroup = await this.prisma.credentialGroupShare.findFirst({
      where: {
        credentialId,
        group: { members: { some: { userId: user.internalUserId } } },
      },
    });
    if (!sharedViaGroup) {
      throw new NotFoundException("Credential not found");
    }
    return row;
  }

  async listShares(credentialId: string, user: RequestUser) {
    await this.assertCanAccessCredential(credentialId, user);
    const [shares, groupShares] = await Promise.all([
      this.prisma.credentialShare.findMany({
        where: { credentialId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, status: true },
          },
          grantedBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.credentialGroupShare.findMany({
        where: { credentialId },
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
          grantedBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      count: shares.length,
      shares: shares.map((s) => ({
        id: s.id,
        userId: s.userId,
        email: s.user.email,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        status: s.user.status,
        grantedByEmail: s.grantedBy.email,
        createdAt: s.createdAt,
      })),
      groupCount: groupShares.length,
      groups: groupShares.map((gs) => ({
        id: gs.id,
        groupId: gs.groupId,
        name: gs.group.name,
        color: gs.group.color,
        memberCount: gs.group._count.members,
        grantedByEmail: gs.grantedBy.email,
        createdAt: gs.createdAt,
      })),
    };
  }

  async share(credentialId: string, user: RequestUser, body: unknown) {
    const parsed = shareCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const row = await this.assertCanAccessCredential(credentialId, user);
    const admin = await this.isShareAdmin(user.internalUserId, user.organizationId);
    if (!admin && row.createdById !== user.internalUserId) {
      throw new ForbiddenException("Only the creator or an admin can share this credential");
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        status: "active",
        memberships: { some: { organizationId: user.organizationId } },
      },
    });
    if (!target) {
      throw new NotFoundException("Employee not found or not active");
    }
    if (target.id === user.internalUserId) {
      throw new BadRequestException("Cannot share with yourself");
    }

    const share = await this.prisma.credentialShare.upsert({
      where: {
        credentialId_userId: { credentialId, userId: target.id },
      },
      create: {
        credentialId,
        userId: target.id,
        grantedById: user.internalUserId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.share",
      resourceType: "credential",
      resourceId: credentialId,
      metadata: { sharedWith: target.email },
    });

    return {
      id: share.id,
      userId: share.userId,
      email: share.user.email,
      firstName: share.user.firstName,
      lastName: share.user.lastName,
      createdAt: share.createdAt,
    };
  }

  async unshare(credentialId: string, userId: string, actor: RequestUser) {
    const row = await this.assertCanAccessCredential(credentialId, actor);
    const admin = await this.isShareAdmin(actor.internalUserId, actor.organizationId);
    if (!admin && row.createdById !== actor.internalUserId) {
      throw new ForbiddenException("Only the creator or an admin can revoke access");
    }
    const existing = await this.prisma.credentialShare.findUnique({
      where: { credentialId_userId: { credentialId, userId } },
    });
    if (!existing) {
      throw new NotFoundException("Share not found");
    }
    await this.prisma.credentialShare.delete({ where: { id: existing.id } });
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "credential.unshare",
      resourceType: "credential",
      resourceId: credentialId,
      metadata: { revokedUserId: userId },
    });
    return { ok: true };
  }

  async shareWithGroup(credentialId: string, user: RequestUser, body: unknown) {
    const parsed = shareCredentialWithGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const row = await this.assertCanAccessCredential(credentialId, user);
    const admin = await this.isShareAdmin(user.internalUserId, user.organizationId);
    if (!admin && row.createdById !== user.internalUserId) {
      throw new ForbiddenException("Only the creator or an admin can share this credential");
    }

    const group = await this.prisma.group.findFirst({
      where: { id: parsed.data.groupId, organizationId: user.organizationId },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }

    const share = await this.prisma.credentialGroupShare.upsert({
      where: {
        credentialId_groupId: { credentialId, groupId: group.id },
      },
      create: {
        credentialId,
        groupId: group.id,
        grantedById: user.internalUserId,
      },
      update: {},
      include: {
        group: { include: { _count: { select: { members: true } } } },
      },
    });

    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.share.group",
      resourceType: "credential",
      resourceId: credentialId,
      metadata: { sharedWithGroup: group.name },
    });

    return {
      id: share.id,
      groupId: share.groupId,
      name: share.group.name,
      color: share.group.color,
      memberCount: share.group._count.members,
      createdAt: share.createdAt,
    };
  }

  async unshareGroup(credentialId: string, groupId: string, actor: RequestUser) {
    const row = await this.assertCanAccessCredential(credentialId, actor);
    const admin = await this.isShareAdmin(actor.internalUserId, actor.organizationId);
    if (!admin && row.createdById !== actor.internalUserId) {
      throw new ForbiddenException("Only the creator or an admin can revoke access");
    }
    const existing = await this.prisma.credentialGroupShare.findUnique({
      where: { credentialId_groupId: { credentialId, groupId } },
      include: { group: { select: { name: true } } },
    });
    if (!existing) {
      throw new NotFoundException("Share not found");
    }
    await this.prisma.credentialGroupShare.delete({ where: { id: existing.id } });
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "credential.unshare.group",
      resourceType: "credential",
      resourceId: credentialId,
      metadata: { revokedGroupId: groupId, revokedGroupName: existing.group.name },
    });
    return { ok: true };
  }
}
