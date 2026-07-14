import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isOrgMetadataRole, type PermissionKey } from "./permissions";

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async userHasPermission(
    userId: string,
    organizationId: string,
    permissionKey: PermissionKey,
  ): Promise<boolean> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId, organizationId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    for (const ur of rows) {
      for (const rp of ur.role.rolePermissions) {
        if (rp.permission.key === permissionKey) {
          return true;
        }
      }
    }
    return false;
  }

  async userRoleNames(userId: string, organizationId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId, organizationId },
      include: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }

  async canSeeAllOrgCredentials(userId: string, organizationId: string): Promise<boolean> {
    const names = await this.userRoleNames(userId, organizationId);
    return names.some((n) => isOrgMetadataRole(n));
  }
}
