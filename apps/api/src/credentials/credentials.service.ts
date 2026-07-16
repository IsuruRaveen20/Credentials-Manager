import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createCredentialSchema,
  isAccessKeyCategory,
  isSshCategory,
  isTokenCategory,
  rotateCredentialSchema,
  updateCredentialSchema,
} from "@vaultops/shared";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/current-user.decorator";
import { CryptoService } from "../crypto/crypto.service";
import { ENVELOPE_KMS, type EnvelopeKms } from "../kms/envelope-kms.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { SecurityService } from "../security/security.service";

type SecretPayload = {
  secret: string;
  notes: string;
  passphrase?: string;
  /** SSH login password (optional; private key may live in `secret`). */
  password?: string;
};

const META_SELECT = {
  id: true,
  name: true,
  category: true,
  loginKind: true,
  username: true,
  host: true,
  port: true,
  logoDataUrl: true,
  tags: true,
  notesPresent: true,
  expiresAt: true,
  lastRotatedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { shares: true, groupShares: true } },
} as const;

function parseExpiresAt(raw: string | null | undefined): Date | null {
  if (raw == null || raw === "") return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException("Invalid expiresAt");
  }
  return d;
}

function mapMeta(row: {
  id: string;
  name: string;
  category: string;
  loginKind: string;
  username: string | null;
  host: string | null;
  port: number | null;
  logoDataUrl: string | null;
  tags: string[];
  notesPresent: boolean;
  expiresAt: Date | null;
  lastRotatedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { shares: number; groupShares: number };
}) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    loginKind: row.loginKind,
    username: row.username,
    host: row.host,
    port: row.port,
    logoDataUrl: row.logoDataUrl,
    tags: row.tags,
    notesPresent: row.notesPresent,
    expiresAt: row.expiresAt,
    lastRotatedAt: row.lastRotatedAt,
    createdById: row.createdById,
    shareCount: row._count.shares,
    groupShareCount: row._count.groupShares,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(ENVELOPE_KMS) private readonly kms: EnvelopeKms,
    private readonly audit: AuditService,
    private readonly security: SecurityService,
    private readonly rbac: RbacService,
  ) {}

  private async visibilityWhere(user: RequestUser): Promise<Prisma.CredentialWhereInput> {
    const seeAll = await this.rbac.canSeeAllOrgCredentials(
      user.internalUserId,
      user.organizationId,
    );
    if (seeAll) {
      return { organizationId: user.organizationId };
    }
    return {
      organizationId: user.organizationId,
      OR: [
        { createdById: user.internalUserId },
        { shares: { some: { userId: user.internalUserId } } },
        {
          groupShares: {
            some: { group: { members: { some: { userId: user.internalUserId } } } },
          },
        },
      ],
    };
  }

  private async upsertCategory(organizationId: string, name: string) {
    await this.prisma.credentialCategory.upsert({
      where: { organizationId_name: { organizationId, name } },
      create: { organizationId, name },
      update: {},
    });
  }

  private async encryptNewPayload(payload: SecretPayload) {
    const { plaintextDek, encryptedDek, keyId } = await this.kms.generateDataKey();
    try {
      const encryptedPayload = this.crypto.encryptPayload(
        Buffer.from(JSON.stringify(payload), "utf8"),
        plaintextDek,
      );
      return {
        encryptedPayload: encryptedPayload.toString("base64"),
        encryptedDek: encryptedDek.toString("base64"),
        kmsKeyId: keyId,
      };
    } finally {
      plaintextDek.fill(0);
    }
  }

  private async decryptPayload(row: {
    encryptedPayload: string;
    encryptedDek: string;
  }): Promise<SecretPayload> {
    const currentDek = await this.kms.decryptDataKey(Buffer.from(row.encryptedDek, "base64"));
    try {
      const plain = this.crypto.decryptPayload(
        Buffer.from(row.encryptedPayload, "base64"),
        currentDek,
      );
      const parsed = JSON.parse(plain.toString("utf8")) as SecretPayload;
      return {
        secret: parsed.secret,
        notes: parsed.notes ?? "",
        passphrase: parsed.passphrase ?? "",
        password: parsed.password ?? "",
      };
    } finally {
      currentDek.fill(0);
    }
  }

  async list(user: RequestUser) {
    const where = await this.visibilityWhere(user);
    const rows = await this.prisma.credential.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: META_SELECT,
    });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.read",
      resourceType: "vault",
      resourceId: user.organizationId,
      metadata: { count: rows.length },
    });
    return rows.map(mapMeta);
  }

  async listCategories(user: RequestUser) {
    const where = await this.visibilityWhere(user);
    const grouped = await this.prisma.credential.groupBy({
      by: ["category"],
      where,
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    return grouped.map((g) => ({
      category: g.category,
      count: g._count._all,
    }));
  }

  async getMeta(id: string, user: RequestUser) {
    const where = await this.visibilityWhere(user);
    const row = await this.prisma.credential.findFirst({
      where: { ...where, id },
      select: META_SELECT,
    });
    if (!row) {
      throw new NotFoundException("Credential not found");
    }
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.read",
      resourceType: "credential",
      resourceId: id,
    });
    return mapMeta(row);
  }

  async create(user: RequestUser, body: unknown) {
    const parsed = createCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;
    const ssh = isSshCategory(input.category);
    const accessKey = isAccessKeyCategory(input.category);
    const token = isTokenCategory(input.category);
    const loginKind = ssh || accessKey ? "username" : token ? "none" : (input.loginKind ?? "username");
    const identity =
      loginKind === "none" && !ssh && !accessKey
        ? null
        : input.username?.trim()
          ? input.username.trim()
          : null;
    const expiresAt = parseExpiresAt(input.expiresAt ?? null);
    const enc = await this.encryptNewPayload({
      secret: input.secret ?? "",
      notes: input.notes ?? "",
      passphrase: input.passphrase?.trim() ? input.passphrase.trim() : "",
      password: input.password?.trim() ? input.password.trim() : "",
    });
    const row = await this.prisma.credential.create({
      data: {
        organizationId: user.organizationId,
        name: input.name,
        category: input.category,
        loginKind,
        username: identity,
        host: input.host?.trim() ? input.host.trim() : null,
        port: input.port ?? (ssh ? 22 : null),
        logoDataUrl: input.logoDataUrl?.trim() ? input.logoDataUrl.trim() : null,
        encryptedPayload: enc.encryptedPayload,
        encryptedDek: enc.encryptedDek,
        kmsKeyId: enc.kmsKeyId,
        tags: input.tags ?? [],
        notesPresent: Boolean(input.notes?.trim()),
        expiresAt,
        createdById: user.internalUserId,
      },
      select: META_SELECT,
    });
    await this.upsertCategory(user.organizationId, input.category);
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.create",
      resourceType: "credential",
      resourceId: row.id,
      metadata: { name: row.name, category: row.category, loginKind: row.loginKind },
    });
    return mapMeta(row);
  }

  async update(id: string, user: RequestUser, body: unknown) {
    const where = await this.visibilityWhere(user);
    const existing = await this.prisma.credential.findFirst({
      where: { ...where, id },
    });
    if (!existing) {
      throw new NotFoundException("Credential not found");
    }
    const parsed = updateCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;
    if (Object.keys(input).length === 0) {
      throw new BadRequestException("No fields to update");
    }

    const currentPayload = await this.decryptPayload(existing);
    const nextSecret = input.secret ?? currentPayload.secret;
    const nextNotes = input.notes ?? currentPayload.notes;
    const nextPassphrase =
      input.passphrase !== undefined
        ? (input.passphrase?.trim() ?? "")
        : (currentPayload.passphrase ?? "");
    const nextPassword =
      input.password !== undefined
        ? (input.password?.trim() ?? "")
        : (currentPayload.password ?? "");
    const nextCategory = input.category ?? existing.category;
    const ssh = isSshCategory(nextCategory);
    const accessKey = isAccessKeyCategory(nextCategory);
    const token = isTokenCategory(nextCategory);
    const nextLoginKind =
      ssh || accessKey
        ? "username"
        : token
          ? "none"
          : (input.loginKind ?? existing.loginKind);
    let nextUsername = existing.username;
    if (input.username !== undefined) {
      nextUsername = input.username?.trim() ? input.username.trim() : null;
    }
    if (nextLoginKind === "none" && !ssh && !accessKey) {
      nextUsername = null;
    }

    const nextHost =
      input.host !== undefined
        ? input.host?.trim()
          ? input.host.trim()
          : null
        : existing.host;
    const nextPort =
      input.port !== undefined ? input.port : existing.port ?? (ssh ? 22 : null);
    const nextExpiresAt =
      input.expiresAt !== undefined
        ? parseExpiresAt(input.expiresAt)
        : existing.expiresAt;

    const enc = await this.encryptNewPayload({
      secret: nextSecret,
      notes: nextNotes,
      passphrase: nextPassphrase,
      password: nextPassword,
    });

    const row = await this.prisma.credential.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        category: nextCategory,
        loginKind: nextLoginKind,
        username: nextUsername,
        host: nextHost,
        port: nextPort,
        ...(input.logoDataUrl !== undefined
          ? {
              logoDataUrl: input.logoDataUrl?.trim() ? input.logoDataUrl.trim() : null,
            }
          : {}),
        tags: input.tags ?? existing.tags,
        notesPresent: Boolean(nextNotes.trim()),
        expiresAt: nextExpiresAt,
        ...(input.secret
          ? { lastRotatedAt: new Date() }
          : {}),
        encryptedPayload: enc.encryptedPayload,
        encryptedDek: enc.encryptedDek,
        kmsKeyId: enc.kmsKeyId,
      },
      select: META_SELECT,
    });
    if (input.category) {
      await this.upsertCategory(user.organizationId, nextCategory);
    }
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.update",
      resourceType: "credential",
      resourceId: id,
    });
    return mapMeta(row);
  }

  async rotate(id: string, user: RequestUser, body: unknown) {
    const where = await this.visibilityWhere(user);
    const existing = await this.prisma.credential.findFirst({
      where: { ...where, id },
    });
    if (!existing) {
      throw new NotFoundException("Credential not found");
    }
    const parsed = rotateCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;
    const currentPayload = await this.decryptPayload(existing);
    const enc = await this.encryptNewPayload({
      secret: input.secret,
      notes: currentPayload.notes,
      passphrase:
        input.passphrase !== undefined
          ? (input.passphrase?.trim() ?? "")
          : (currentPayload.passphrase ?? ""),
      password:
        input.password !== undefined
          ? (input.password?.trim() ?? "")
          : (currentPayload.password ?? ""),
    });
    const row = await this.prisma.credential.update({
      where: { id },
      data: {
        encryptedPayload: enc.encryptedPayload,
        encryptedDek: enc.encryptedDek,
        kmsKeyId: enc.kmsKeyId,
        lastRotatedAt: new Date(),
        ...(input.expiresAt !== undefined
          ? { expiresAt: parseExpiresAt(input.expiresAt) }
          : {}),
      },
      select: META_SELECT,
    });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.rotate",
      resourceType: "credential",
      resourceId: id,
    });
    return mapMeta(row);
  }

  async getForEdit(id: string, user: RequestUser) {
    const where = await this.visibilityWhere(user);
    const row = await this.prisma.credential.findFirst({
      where: { ...where, id },
    });
    if (!row) {
      throw new NotFoundException("Credential not found");
    }
    const payload = await this.decryptPayload(row);
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.edit_view",
      resourceType: "credential",
      resourceId: id,
    });
    // Notes + SSH password for editors; private key still requires step-up reveal.
    return {
      id: row.id,
      notes: payload.notes ?? "",
      password: payload.password ?? "",
    };
  }

  async reveal(
    id: string,
    user: RequestUser,
    opts: {
      ip?: string | null;
      userAgent?: string | null;
      stepUpOk: boolean;
    },
  ) {
    if (!opts.stepUpOk) {
      await this.audit.log({
        actorId: user.internalUserId,
        action: "auth.denied",
        resourceType: "credential",
        resourceId: id,
        ip: opts.ip ?? undefined,
        metadata: { reason: "step_up_required" },
      });
      throw new UnauthorizedException("Confirm your password to reveal this secret");
    }
    const where = await this.visibilityWhere(user);
    const row = await this.prisma.credential.findFirst({
      where: { ...where, id },
    });
    if (!row) {
      throw new NotFoundException("Credential not found");
    }
    const payload = await this.decryptPayload(row);
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.reveal",
      resourceType: "credential",
      resourceId: id,
      ip: opts.ip ?? undefined,
      userAgent: opts.userAgent ?? undefined,
    });
    await this.security.recordRevealSuccess(user.internalUserId);
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      loginKind: row.loginKind,
      username: row.username,
      host: row.host,
      port: row.port,
      tags: row.tags,
      expiresAt: row.expiresAt,
      lastRotatedAt: row.lastRotatedAt,
      secret: payload.secret,
      notes: payload.notes,
      password: payload.password || null,
      passphrase: payload.passphrase || null,
    };
  }

  async remove(id: string, user: RequestUser) {
    const where = await this.visibilityWhere(user);
    const row = await this.prisma.credential.findFirst({
      where: { ...where, id },
    });
    if (!row) {
      throw new NotFoundException("Credential not found");
    }
    await this.prisma.credential.delete({ where: { id } });
    await this.audit.log({
      actorId: user.internalUserId,
      action: "credential.delete",
      resourceType: "credential",
      resourceId: id,
      metadata: { name: row.name },
    });
    return { ok: true };
  }
}
