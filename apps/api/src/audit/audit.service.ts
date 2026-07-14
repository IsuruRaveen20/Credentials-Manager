import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

export type AuditLogInput = {
  actorId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        resourceType: input.resourceType ?? undefined,
        resourceId: input.resourceId ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
        metadata: input.metadata as object | undefined,
      },
    });
  }

  async list(
    user: RequestUser,
    opts: {
      limit?: number;
      action?: string;
      actionPrefix?: string;
      resourceId?: string;
    } = {},
  ) {
    const take = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    return this.prisma.auditLog.findMany({
      where: {
        AND: [
          {
            OR: [
              { actorId: user.internalUserId },
              {
                resourceType: { in: ["credential", "vault"] },
                resourceId: {
                  in: [
                    user.organizationId,
                    ...(
                      await this.prisma.credential.findMany({
                        where: { organizationId: user.organizationId },
                        select: { id: true },
                      })
                    ).map((c) => c.id),
                  ],
                },
              },
              {
                action: {
                  in: ["auth.denied", "security.suspicious", "role.assign", "role.revoke"],
                },
                actor: {
                  memberships: { some: { organizationId: user.organizationId } },
                },
              },
            ],
          },
          ...(opts.resourceId ? [{ resourceId: opts.resourceId }] : []),
          ...(opts.action ? [{ action: opts.action }] : []),
          ...(opts.actionPrefix && !opts.action
            ? [{ action: { startsWith: opts.actionPrefix } }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: { select: { id: true, email: true } },
      },
    });
  }
}
