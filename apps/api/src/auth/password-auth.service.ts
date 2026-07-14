import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { loginSchema, setPasswordSchema, stepUpSchema } from "@vaultops/shared";
import * as bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { generateInviteToken, hashToken, PasswordJwtService } from "./password-jwt.service";
import type { RequestUser } from "./current-user.decorator";

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: PasswordJwtService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async verifyInviteToken(token: string) {
    const tokenHash = hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        inviteTokenHash: tokenHash,
        status: { in: ["invited", "active"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        inviteExpiresAt: true,
        emailVerifiedAt: true,
        status: true,
      },
    });
    if (!user) {
      throw new BadRequestException("Invalid or expired invite token");
    }
    if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invite token has expired");
    }
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      alreadyVerified: Boolean(user.emailVerifiedAt),
    };
  }

  async setPassword(body: unknown) {
    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { token, password } = parsed.data;
    const tokenHash = hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: { inviteTokenHash: tokenHash },
    });
    if (!user) {
      throw new BadRequestException("Invalid or expired invite token");
    }
    if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invite token has expired");
    }
    if (user.status === "disabled") {
      throw new UnauthorizedException("Account is disabled");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        status: "active",
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
    await this.audit.log({
      actorId: user.id,
      action: "auth.verify",
      resourceType: "user",
      resourceId: user.id,
      metadata: { email: user.email },
    });
    return { ok: true, email: user.email };
  }

  async login(body: unknown, ip?: string | null) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: true,
      },
    });
    if (!user?.passwordHash || user.status !== "active") {
      await this.audit.log({
        action: "auth.denied",
        resourceType: "login",
        ip: ip ?? undefined,
        metadata: { email },
      });
      throw new UnauthorizedException("Invalid email or password");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.id,
        action: "auth.denied",
        resourceType: "login",
        ip: ip ?? undefined,
        metadata: { email },
      });
      throw new UnauthorizedException("Invalid email or password");
    }
    const orgId =
      user.memberships[0]?.organizationId ??
      this.config.get<string>("DEFAULT_ORGANIZATION_ID");
    if (!orgId) {
      throw new UnauthorizedException("No organization membership");
    }
    const accessToken = await this.jwt.signSession({
      sub: user.id,
      email: user.email,
      organizationId: orgId,
    });
    await this.audit.log({
      actorId: user.id,
      action: "auth.login",
      resourceType: "user",
      resourceId: user.id,
      ip: ip ?? undefined,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: orgId,
      },
    };
  }

  async resolveSessionUser(claims: {
    sub: string;
    email: string;
    organizationId: string;
  }): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User inactive");
    }
    return {
      clerkId: user.clerkId ?? user.id,
      email: user.email,
      internalUserId: user.id,
      organizationId: claims.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  mintInviteToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = generateInviteToken();
    return {
      raw,
      hash: hashToken(raw),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    };
  }

  async stepUp(user: RequestUser, body: unknown, ip?: string | null) {
    const parsed = stepUpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const row = await this.prisma.user.findUnique({ where: { id: user.internalUserId } });
    if (!row?.passwordHash || row.status !== "active") {
      throw new UnauthorizedException("Cannot confirm password");
    }
    const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.internalUserId,
        action: "auth.denied",
        resourceType: "step_up",
        ip: ip ?? undefined,
      });
      throw new UnauthorizedException("Incorrect password");
    }
    const stepUpToken = await this.jwt.signStepUp(user.internalUserId);
    await this.audit.log({
      actorId: user.internalUserId,
      action: "auth.step_up",
      resourceType: "user",
      resourceId: user.internalUserId,
      ip: ip ?? undefined,
    });
    return { stepUpToken, expiresInSeconds: 300 };
  }
}
