"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, hasSessionToken } from "@/lib/api";

export const PERMS = {
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

export type Permission = (typeof PERMS)[keyof typeof PERMS] | string;

/** Consistent no-access copy used across the app. */
export const ACCESS_DENIED = {
  title: "No access",
  credentialWrite: "Your role can’t add or edit credentials. Ask an admin for Editor access.",
  credentialDelete: "Your role can’t delete credentials.",
  credentialShare: "Your role can’t share credentials.",
  categoryWrite: "Your role can’t manage credential categories.",
  employeeInvite: "Your role can’t invite employees.",
  employeeManage: "Your role can’t manage employees.",
  roleAssign: "Your role can’t change employee roles.",
  generic: "Your role doesn’t include permission for this action.",
} as const;

export type MeUser = {
  id?: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  permissions?: string[];
  organization: { id: string; name: string } | null;
};

type AccessContextValue = {
  me: MeUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  can: (permission: Permission) => boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<MeUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasSessionToken()) {
      setMe(null);
      setReady(true);
      return;
    }
    try {
      setMe(await apiFetch<MeUser>("/org/me"));
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const can = useCallback(
    (permission: Permission) => {
      if (!me) return false;
      if (me.permissions?.includes(permission)) return true;
      // Fallback for older /org/me without permissions: owner/admin treat as full access
      if (me.roles.some((r) => r === "owner" || r === "admin")) return true;
      return false;
    },
    [me],
  );

  const value = useMemo(
    () => ({ me, ready, refresh, can }),
    [me, ready, refresh, can],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccess must be used within AccessProvider");
  }
  return ctx;
}
