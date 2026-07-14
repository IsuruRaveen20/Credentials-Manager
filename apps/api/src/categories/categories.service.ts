import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createCategorySchema, normalizeCategory, PRESET_CREDENTIAL_CATEGORIES } from "@vaultops/shared";
import type { RequestUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePresets(organizationId: string) {
    for (const name of PRESET_CREDENTIAL_CATEGORIES) {
      await this.prisma.credentialCategory.upsert({
        where: {
          organizationId_name: { organizationId, name },
        },
        create: { organizationId, name },
        update: {},
      });
    }
  }

  async list(user: RequestUser) {
    await this.ensurePresets(user.organizationId);

    const [rows, usage] = await Promise.all([
      this.prisma.credentialCategory.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
      }),
      this.prisma.credential.groupBy({
        by: ["category"],
        where: { organizationId: user.organizationId },
        _count: { _all: true },
      }),
    ]);

    const countBy = new Map(
      usage.map((u) => [normalizeCategory(u.category).toLowerCase(), u._count._all]),
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      credentialCount: countBy.get(r.name.toLowerCase()) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isPreset: (PRESET_CREDENTIAL_CATEGORIES as readonly string[]).includes(r.name),
    }));
  }

  async create(user: RequestUser, body: unknown) {
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const name = parsed.data.name;
    try {
      const row = await this.prisma.credentialCategory.create({
        data: {
          organizationId: user.organizationId,
          name,
        },
      });
      return {
        id: row.id,
        name: row.name,
        credentialCount: 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isPreset: false,
      };
    } catch {
      throw new BadRequestException("Category already exists");
    }
  }

  async remove(user: RequestUser, id: string) {
    const row = await this.prisma.credentialCategory.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      throw new NotFoundException("Category not found");
    }
    const inUse = await this.prisma.credential.count({
      where: {
        organizationId: user.organizationId,
        category: { equals: row.name, mode: "insensitive" },
      },
    });
    if (inUse > 0) {
      throw new BadRequestException("Category is in use by credentials");
    }
    if ((PRESET_CREDENTIAL_CATEGORIES as readonly string[]).includes(row.name)) {
      throw new BadRequestException("Preset categories cannot be deleted");
    }
    await this.prisma.credentialCategory.delete({ where: { id } });
    return { ok: true };
  }
}
