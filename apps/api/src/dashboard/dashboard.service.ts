import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async stats(user: RequestUser) {
    const orgId = user.organizationId;
    const seeAll = await this.rbac.canSeeAllOrgCredentials(user.internalUserId, orgId);

    const credentialWhere = seeAll
      ? { organizationId: orgId }
      : {
          organizationId: orgId,
          OR: [
            { createdById: user.internalUserId },
            { shares: { some: { userId: user.internalUserId } } },
          ],
        };

    const [
      credentialCount,
      byCategory,
      employeesActive,
      employeesInvited,
      sharesGranted,
      sharesReceived,
      recentAudit,
      threatCount,
    ] = await Promise.all([
      this.prisma.credential.count({ where: credentialWhere }),
      this.prisma.credential.groupBy({
        by: ["category"],
        where: credentialWhere,
        _count: { _all: true },
      }),
      this.prisma.organizationMember.count({
        where: { organizationId: orgId, user: { status: "active" } },
      }),
      this.prisma.organizationMember.count({
        where: { organizationId: orgId, user: { status: "invited" } },
      }),
      this.prisma.credentialShare.count({
        where: {
          grantedById: user.internalUserId,
          credential: { organizationId: orgId },
        },
      }),
      this.prisma.credentialShare.count({
        where: {
          userId: user.internalUserId,
          credential: { organizationId: orgId },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { actorId: user.internalUserId },
            {
              resourceType: "credential",
              resourceId: {
                in: (
                  await this.prisma.credential.findMany({
                    where: credentialWhere,
                    select: { id: true },
                    take: 500,
                  })
                ).map((c) => c.id),
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ["security.suspicious", "auth.denied"] },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          actor: { memberships: { some: { organizationId: orgId } } },
        },
      }),
    ]);

    return {
      credentials: {
        total: credentialCount,
        byCategory: byCategory.map((c) => ({
          category: c.category,
          count: c._count._all,
        })),
      },
      employees: {
        active: employeesActive,
        invited: employeesInvited,
        total: employeesActive + employeesInvited,
      },
      shares: {
        grantedByYou: sharesGranted,
        sharedWithYou: sharesReceived,
      },
      threatsLast7Days: threatCount,
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        actorEmail: a.actor?.email ?? null,
        createdAt: a.createdAt,
      })),
    };
  }
}
