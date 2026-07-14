import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { inviteEmployeeSchema, setEmployeeRoleSchema } from "@vaultops/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/current-user.decorator";
import { PasswordAuthService } from "../auth/password-auth.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly passwordAuth: PasswordAuthService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(user: RequestUser) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
            emailVerifiedAt: true,
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
      status: m.user.status,
      joinedAt: m.user.createdAt,
      emailVerifiedAt: m.user.emailVerifiedAt,
      roles: m.user.userRoles.map((ur) => ur.role.name),
    }));
  }

  async invite(actor: RequestUser, body: unknown) {
    const parsed = inviteEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;
    const email = input.email.toLowerCase();
    if (input.role === "owner") {
      throw new BadRequestException("Cannot invite another Owner via this flow");
    }

    const role = await this.prisma.role.findUnique({ where: { name: input.role } });
    if (!role) {
      throw new BadRequestException("Unknown role");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.status === "active") {
      throw new ConflictException("User already active");
    }

    const invite = this.passwordAuth.mintInviteToken();
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            status: "invited",
            inviteTokenHash: invite.hash,
            inviteExpiresAt: invite.expiresAt,
            passwordHash: null,
            emailVerifiedAt: null,
          },
        })
      : await this.prisma.user.create({
          data: {
            email,
            firstName: input.firstName,
            lastName: input.lastName,
            status: "invited",
            inviteTokenHash: invite.hash,
            inviteExpiresAt: invite.expiresAt,
          },
        });

    await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: actor.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: actor.organizationId,
        userId: user.id,
      },
      update: {},
    });

    await this.prisma.userRole.deleteMany({
      where: { userId: user.id, organizationId: actor.organizationId },
    });
    await this.prisma.userRole.create({
      data: {
        organizationId: actor.organizationId,
        userId: user.id,
        roleId: role.id,
      },
    });

    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:13000");
    const verifyUrl = `${webOrigin.replace(/\/$/, "")}/accept-invite?token=${invite.raw}`;
    await this.mail.sendInviteEmail({
      to: email,
      firstName: input.firstName,
      verifyUrl,
    });

    await this.audit.log({
      actorId: actor.internalUserId,
      action: "employee.invite",
      resourceType: "user",
      resourceId: user.id,
      metadata: { email, role: input.role },
    });
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "role.assign",
      resourceType: "user",
      resourceId: user.id,
      metadata: { role: input.role },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: [input.role],
      // Returned only when console email — helps local Docker testing
      invitePreviewUrl:
        this.config.get<string>("EMAIL_PROVIDER", "console") === "console"
          ? verifyUrl
          : undefined,
    };
  }

  async resendInvite(actor: RequestUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { organizationId: actor.organizationId } },
      },
    });
    if (!user) {
      throw new NotFoundException("Employee not found");
    }
    if (user.status === "disabled") {
      throw new BadRequestException("Employee is disabled");
    }
    const invite = this.passwordAuth.mintInviteToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: "invited",
        inviteTokenHash: invite.hash,
        inviteExpiresAt: invite.expiresAt,
      },
    });
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:13000");
    const verifyUrl = `${webOrigin.replace(/\/$/, "")}/accept-invite?token=${invite.raw}`;
    await this.mail.sendInviteEmail({
      to: user.email,
      firstName: user.firstName ?? "there",
      verifyUrl,
    });
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "employee.invite",
      resourceType: "user",
      resourceId: user.id,
      metadata: { resend: true, email: user.email },
    });
    return {
      ok: true,
      invitePreviewUrl:
        this.config.get<string>("EMAIL_PROVIDER", "console") === "console"
          ? verifyUrl
          : undefined,
    };
  }

  async disable(actor: RequestUser, userId: string) {
    if (actor.internalUserId === userId) {
      throw new BadRequestException("Cannot disable yourself");
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { organizationId: actor.organizationId } },
      },
    });
    if (!user) {
      throw new NotFoundException("Employee not found");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: "disabled", inviteTokenHash: null, inviteExpiresAt: null },
    });
    await this.prisma.credentialShare.deleteMany({ where: { userId } });
    const revoked = await this.prisma.userRole.findMany({
      where: { userId, organizationId: actor.organizationId },
      include: { role: { select: { name: true } } },
    });
    await this.prisma.userRole.deleteMany({
      where: { userId, organizationId: actor.organizationId },
    });
    for (const ur of revoked) {
      await this.audit.log({
        actorId: actor.internalUserId,
        action: "role.revoke",
        resourceType: "user",
        resourceId: userId,
        metadata: { role: ur.role.name, reason: "employee.disable" },
      });
    }
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "employee.disable",
      resourceType: "user",
      resourceId: userId,
      metadata: { email: user.email },
    });
    return { ok: true };
  }

  async setRole(actor: RequestUser, userId: string, body: unknown) {
    if (actor.internalUserId === userId) {
      throw new BadRequestException("Cannot change your own role here");
    }
    const parsed = setEmployeeRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId: actor.organizationId, userId },
      include: {
        user: {
          include: {
            userRoles: {
              where: { organizationId: actor.organizationId },
              include: { role: true },
            },
          },
        },
      },
    });
    if (!member) {
      throw new NotFoundException("Employee not found");
    }
    if (member.user.userRoles.some((ur) => ur.role.name === "owner")) {
      throw new BadRequestException("Cannot change Owner role via this flow");
    }
    const role = await this.prisma.role.findUnique({ where: { name: parsed.data.role } });
    if (!role) {
      throw new BadRequestException("Unknown role");
    }
    const previous = member.user.userRoles.map((ur) => ur.role.name);
    await this.prisma.userRole.deleteMany({
      where: { userId, organizationId: actor.organizationId },
    });
    await this.prisma.userRole.create({
      data: {
        organizationId: actor.organizationId,
        userId,
        roleId: role.id,
      },
    });
    for (const r of previous) {
      if (r !== parsed.data.role) {
        await this.audit.log({
          actorId: actor.internalUserId,
          action: "role.revoke",
          resourceType: "user",
          resourceId: userId,
          metadata: { role: r },
        });
      }
    }
    await this.audit.log({
      actorId: actor.internalUserId,
      action: "role.assign",
      resourceType: "user",
      resourceId: userId,
      metadata: { role: parsed.data.role },
    });
    return {
      id: userId,
      roles: [parsed.data.role],
    };
  }
}
