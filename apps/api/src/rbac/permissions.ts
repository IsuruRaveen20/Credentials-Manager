export const PERMISSIONS = {
  CREDENTIAL_READ: "credential:read",
  CREDENTIAL_WRITE: "credential:write",
  CREDENTIAL_REVEAL: "credential:reveal",
  CREDENTIAL_DELETE: "credential:delete",
  CREDENTIAL_SHARE: "credential:share",
  EMPLOYEE_INVITE: "employee:invite",
  EMPLOYEE_MANAGE: "employee:manage",
  ROLE_ASSIGN: "role:assign",
  AUDIT_READ: "audit:read",
  ORG_ADMIN: "org:admin",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ORG_WIDE_ROLES = ["owner", "admin"] as const;
/** Roles that see all credential metadata in the org (still need reveal perm to decrypt). */
export const ORG_METADATA_ROLES = ["owner", "admin", "auditor", "viewer"] as const;

export function isOrgWideRole(roleName: string): boolean {
  return (ORG_WIDE_ROLES as readonly string[]).includes(roleName);
}

export function isOrgMetadataRole(roleName: string): boolean {
  return (ORG_METADATA_ROLES as readonly string[]).includes(roleName);
}
