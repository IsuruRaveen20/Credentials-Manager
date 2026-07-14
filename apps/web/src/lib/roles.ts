/** Role ids stored in the API / DB (lowercase). */
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer", "auditor"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type VaultRole = AssignableRole | "owner";

/** Display labels (capitalized). API still uses lowercase ids. */
export function formatRoleLabel(role: string): string {
  const key = role.trim().toLowerCase();
  const map: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
    auditor: "Auditor",
  };
  if (map[key]) return map[key];
  if (!key) return role;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export type RoleCapability = {
  id: string;
  label: string;
};

/** Human-readable capabilities shown on the Roles page matrix. */
export const ROLE_CAPABILITIES: RoleCapability[] = [
  { id: "credential:read", label: "View vault credentials" },
  { id: "credential:reveal", label: "Reveal secrets / passwords" },
  { id: "credential:write", label: "Add & edit credentials" },
  { id: "credential:delete", label: "Delete credentials" },
  { id: "credential:share", label: "Share credentials" },
  { id: "employee:invite", label: "Invite employees" },
  { id: "employee:manage", label: "Manage / disable employees" },
  { id: "role:assign", label: "Assign roles" },
  { id: "audit:read", label: "Read audit log" },
  { id: "org:admin", label: "Organization admin" },
];

/** Matches `apps/api/prisma/seed.ts` ROLE_PERMISSIONS (assignable roles). */
export const ROLE_PERMISSION_SET: Record<AssignableRole, ReadonlySet<string>> = {
  admin: new Set([
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
  ]),
  editor: new Set([
    "credential:read",
    "credential:write",
    "credential:reveal",
    "credential:share",
  ]),
  viewer: new Set(["credential:read", "credential:reveal"]),
  auditor: new Set(["credential:read", "audit:read"]),
};

export const ROLE_GUIDES: {
  id: AssignableRole;
  description: string;
}[] = [
  {
    id: "admin",
    description:
      "Full workspace access. Can manage the vault, invite people, assign roles, and read audit logs.",
  },
  {
    id: "editor",
    description:
      "Day-to-day vault work. Can add, edit, reveal, and share credentials — cannot delete, invite, or change roles.",
  },
  {
    id: "viewer",
    description:
      "Read-only vault access. Can view and reveal secrets when needed, but cannot change anything.",
  },
  {
    id: "auditor",
    description:
      "Compliance / review role. Can browse credential metadata and the audit log, but cannot reveal secrets or edit the vault.",
  },
];

export function roleHasCapability(role: AssignableRole, capabilityId: string): boolean {
  return ROLE_PERMISSION_SET[role].has(capabilityId);
}
