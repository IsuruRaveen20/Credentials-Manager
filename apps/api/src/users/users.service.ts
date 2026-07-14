import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/current-user.decorator";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private assertAllowedDomain(email: string) {
    const raw = this.config.get<string>("ALLOWED_EMAIL_DOMAINS");
    if (!raw?.trim()) {
      return;
    }
    const domains = raw
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const at = email.lastIndexOf("@");
    if (at < 0) {
      throw new ForbiddenException("Invalid email");
    }
    const domain = email.slice(at + 1).toLowerCase();
    if (!domains.includes(domain)) {
      throw new ForbiddenException("Email domain is not allowed for VaultOps");
    }
  }

  async resolveRequestContext(input: {
    clerkId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    /** Skip domain gate (local `dev-token` bootstrap only). */
    skipDomainCheck?: boolean;
  }): Promise<RequestUser> {
    if (!input.skipDomainCheck) {
      this.assertAllowedDomain(input.email);
    }

    const defaultOrgId = this.config.get<string>("DEFAULT_ORGANIZATION_ID");
    if (!defaultOrgId) {
      throw new UnauthorizedException("DEFAULT_ORGANIZATION_ID is not configured");
    }

    const email = input.email.toLowerCase();
    // Invite-only: prefer existing invited/active member by email; link Clerk id.
    // Do not auto-create org membership for unknown Clerk users.
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ clerkId: input.clerkId }, { email }],
      },
    });

    if (!user) {
      throw new ForbiddenException(
        "No VaultOps account for this Clerk user. Ask an admin to invite your email first.",
      );
    }

    if (user.status === "disabled") {
      throw new UnauthorizedException("Account is disabled");
    }

    user = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        clerkId: input.clerkId,
        email,
        status: user.status === "invited" ? "active" : user.status,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
      },
    });

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: defaultOrgId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException("User is not a member of this organization");
    }

    const hasAny = await this.prisma.userRole.findFirst({
      where: { userId: user.id, organizationId: defaultOrgId },
    });
    if (!hasAny) {
      const defaultRole =
        (await this.prisma.role.findUnique({ where: { name: "viewer" } })) ??
        (await this.prisma.role.findUnique({ where: { name: "admin" } }));
      if (defaultRole) {
        await this.prisma.userRole.create({
          data: {
            organizationId: defaultOrgId,
            userId: user.id,
            roleId: defaultRole.id,
          },
        });
      }
    }

    return {
      clerkId: input.clerkId,
      email: user.email,
      internalUserId: user.id,
      organizationId: defaultOrgId,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  async listOrgMembers(user: RequestUser) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            clerkId: true,
            status: true,
            createdAt: true,
            userRoles: {
              where: { organizationId: user.organizationId },
              include: { role: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { user: { email: "asc" } },
    });

    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      clerkId: m.user.clerkId,
      status: m.user.status,
      joinedAt: m.user.createdAt,
      roles: m.user.userRoles.map((ur) => ur.role.name),
    }));
  }

  async getMe(user: RequestUser) {
    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.internalUserId, organizationId: user.organizationId },
      include: {
        role: {
          select: {
            name: true,
            rolePermissions: { include: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true },
    });
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.internalUserId },
      select: { firstName: true, lastName: true, status: true },
    });
    const permissionSet = new Set<string>();
    for (const ur of roles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.key);
      }
    }
    return {
      id: user.internalUserId,
      email: user.email,
      clerkId: user.clerkId,
      firstName: dbUser?.firstName ?? user.firstName,
      lastName: dbUser?.lastName ?? user.lastName,
      status: dbUser?.status,
      organization: org,
      roles: roles.map((r) => r.role.name),
      permissions: Array.from(permissionSet).sort(),
      kmsProvider: process.env.KMS_PROVIDER ?? "local",
      useLocalKms: process.env.USE_LOCAL_KMS === "true",
    };
  }
}
