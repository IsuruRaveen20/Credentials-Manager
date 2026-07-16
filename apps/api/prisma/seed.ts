import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

const DEFAULT_ORG_ID =
  process.env.DEFAULT_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "owner@localhost").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!owner1";
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME ?? "WebMee";
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME ?? "Admin";

const PERMISSION_KEYS = [
  "credential:read",
  "credential:write",
  "credential:reveal",
  "credential:delete",
  "credential:share",
  "employee:invite",
  "employee:manage",
  "role:assign",
  "audit:read",
  "org:admin",
  "group:manage",
] as const;

/** Default teams seeded for every org — matches the common "who can see what" split. */
const DEFAULT_GROUPS: { name: string; description: string; color: string }[] = [
  {
    name: "Senior Developers",
    description: "Full-time senior engineers — broad access to production credentials.",
    color: "#7C5CFC",
  },
  {
    name: "Junior Developers",
    description: "Junior engineers — access to staging / lower-risk credentials.",
    color: "#3DA9FC",
  },
  {
    name: "New Developers",
    description: "Recently onboarded engineers — narrow, need-to-know access only.",
    color: "#3DDC97",
  },
];

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  owner: PERMISSION_KEYS,
  admin: PERMISSION_KEYS,
  editor: [
    "credential:read",
    "credential:write",
    "credential:reveal",
    "credential:share",
  ],
  viewer: ["credential:read", "credential:reveal"],
  auditor: ["credential:read", "audit:read"],
};

async function seedDefaultGroups(organizationId: string, createdById: string) {
  for (const g of DEFAULT_GROUPS) {
    await prisma.group.upsert({
      where: { organizationId_name: { organizationId, name: g.name } },
      create: {
        organizationId,
        name: g.name,
        description: g.description,
        color: g.color,
        createdById,
      },
      update: {},
    });
  }
}

async function main() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    create: { id: DEFAULT_ORG_ID, name: "WebMee Vault" },
    update: { name: "WebMee Vault" },
  });

  const permissions: { id: string; key: string }[] = [];
  for (const key of PERMISSION_KEYS) {
    const p = await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
    permissions.push(p);
  }
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const legacy of ["member"]) {
    const legacyRole = await prisma.role.findUnique({ where: { name: legacy } });
    if (legacyRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: legacyRole.id } });
      await prisma.userRole.deleteMany({ where: { roleId: legacyRole.id } });
      await prisma.role.delete({ where: { id: legacyRole.id } });
    }
  }

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {},
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const key of keys) {
      const permissionId = permissionIdByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  }

  // Admin from .env — invite-only org; no public registration
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "owner" } });
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      passwordHash,
      status: "active",
      emailVerifiedAt: new Date(),
      clerkId: null,
    },
    update: {
      passwordHash,
      status: "active",
      emailVerifiedAt: new Date(),
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: DEFAULT_ORG_ID, userId: owner.id },
    },
    create: { organizationId: DEFAULT_ORG_ID, userId: owner.id },
    update: {},
  });

  await prisma.userRole.deleteMany({
    where: { userId: owner.id, organizationId: DEFAULT_ORG_ID },
  });
  await prisma.userRole.create({
    data: {
      organizationId: DEFAULT_ORG_ID,
      userId: owner.id,
      roleId: ownerRole.id,
    },
  });

  await seedDefaultGroups(DEFAULT_ORG_ID, owner.id);

  // Dev-token persona (AUTH_MODE hybrid/dev) — separate from admin password login
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  const dev = await prisma.user.upsert({
    where: { email: "dev@localhost" },
    create: {
      email: "dev@localhost",
      clerkId: "dev-user",
      firstName: "Dev",
      lastName: "User",
      status: "active",
      emailVerifiedAt: new Date(),
    },
    update: {
      clerkId: "dev-user",
      status: "active",
      firstName: "Dev",
      lastName: "User",
    },
  });
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: DEFAULT_ORG_ID, userId: dev.id },
    },
    create: { organizationId: DEFAULT_ORG_ID, userId: dev.id },
    update: {},
  });
  const hasAdmin = await prisma.userRole.findFirst({
    where: { userId: dev.id, organizationId: DEFAULT_ORG_ID, roleId: adminRole.id },
  });
  if (!hasAdmin) {
    await prisma.userRole.create({
      data: {
        organizationId: DEFAULT_ORG_ID,
        userId: dev.id,
        roleId: adminRole.id,
      },
    });
  }

  // Title-case existing category labels (legacy lowercase rows)
  function normalizeCategory(raw: string): string {
    return raw
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  const cats = await prisma.credential.findMany({ select: { id: true, category: true } });
  for (const row of cats) {
    const next = normalizeCategory(row.category);
    if (next !== row.category) {
      await prisma.credential.update({ where: { id: row.id }, data: { category: next } });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    "Seed complete.",
    "DEFAULT_ORGANIZATION_ID=",
    DEFAULT_ORG_ID,
    "Admin=",
    ADMIN_EMAIL,
    "(password from ADMIN_PASSWORD)",
    "inviteTokenSaltHint=",
    createHash("sha256").update(randomBytes(8)).digest("hex").slice(0, 8),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
