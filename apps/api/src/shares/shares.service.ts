import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { shareCredentialSchema } from "@vaultops/shared";
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
    if (!shared) {
      throw new NotFoundException("Credential not found");
    }
    return row;
  }

  async listShares(credentialId: string, user: RequestUser) {
    await this.assertCanAccessCredential(credentialId, user);
    const shares = await this.prisma.credentialShare.findMany({
      where: { credentialId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, status: true },
        },
        grantedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
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
}
