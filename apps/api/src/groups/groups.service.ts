import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  createGroupSchema,
  groupMemberSchema,
  updateGroupSchema,
} from "@vaultops/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

const MEMBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async findOrThrow(id: string, organizationId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, organizationId },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    return group;
  }

  async list(user: RequestUser) {
    const groups = await this.prisma.group.findMany({
      where: { organizationId: user.organizationId },
      include: { _count: { select: { members: true, shares: true } } },
      orderBy: { name: "asc" },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      color: g.color,
      memberCount: g._count.members,
      sharedCredentialCount: g._count.shares,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  async get(id: string, user: RequestUser) {
    const group = await this.prisma.group.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        members: {
          include: { user: { select: MEMBER_SELECT } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { shares: true } },
      },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      sharedCredentialCount: group._count.shares,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        status: m.user.status,
        addedAt: m.createdAt,
      })),
    };
  }

  async create(user: RequestUser, body: unknown) {
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const name = parsed.data.name.trim();
    const existing = await this.prisma.group.findUnique({
      where: { organizationId_name: { organizationId: user.organizationId, name } },
    });
    if (existing) {
      throw new ConflictException("A group with this name already exists");
    }
    const group = await this.prisma.group.create({
      data: {
        organizationId: user.organizationId,
        name,
        description: parsed.data.description?.trim() || null,
        color: parsed.data.color || null,
        createdById: user.internalUserId,
      },
    });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "group.create",
      resourceType: "group",
      resourceId: group.id,
      metadata: { name: group.name },
    });
    return { ...group, memberCount: 0, sharedCredentialCount: 0 };
  }

  async update(id: string, user: RequestUser, body: unknown) {
    const group = await this.findOrThrow(id, user.organizationId);
    const parsed = updateGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;
    if (Object.keys(input).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      const clash = await this.prisma.group.findFirst({
        where: { organizationId: user.organizationId, name, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException("A group with this name already exists");
      }
    }
    const updated = await this.prisma.group.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        description:
          input.description !== undefined ? input.description?.trim() || null : undefined,
        color: input.color !== undefined ? input.color || null : undefined,
      },
    });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "group.update",
      resourceType: "group",
      resourceId: group.id,
      metadata: { name: updated.name },
    });
    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const group = await this.findOrThrow(id, user.organizationId);
    await this.prisma.group.delete({ where: { id } });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "group.delete",
      resourceType: "group",
      resourceId: id,
      metadata: { name: group.name },
    });
    return { ok: true };
  }

  async addMember(id: string, user: RequestUser, body: unknown) {
    const group = await this.findOrThrow(id, user.organizationId);
    const parsed = groupMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const target = await this.prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        memberships: { some: { organizationId: user.organizationId } },
      },
    });
    if (!target) {
      throw new NotFoundException("Employee not found in this organization");
    }
    await this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: id, userId: target.id } },
      create: { groupId: id, userId: target.id, addedById: user.internalUserId },
      update: {},
    });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "group.member.add",
      resourceType: "group",
      resourceId: group.id,
      metadata: { name: group.name, memberEmail: target.email },
    });
    return {
      id: target.id,
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      status: target.status,
    };
  }

  async removeMember(id: string, memberId: string, user: RequestUser) {
    const group = await this.findOrThrow(id, user.organizationId);
    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: memberId } },
      include: { user: { select: { email: true } } },
    });
    if (!existing) {
      throw new NotFoundException("Member not found in this group");
    }
    await this.prisma.groupMember.delete({ where: { id: existing.id } });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "group.member.remove",
      resourceType: "group",
      resourceId: group.id,
      metadata: { name: group.name, memberEmail: existing.user.email },
    });
    return { ok: true };
  }
}
