"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatRoleLabel } from "@/lib/roles";

type Me = {
  email: string;
  clerkId: string;
  organization: { id: string; name: string } | null;
  roles: string[];
  kmsProvider: string;
  useLocalKms: boolean;
};

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:13001";

  const load = useCallback(async () => {
    try {
      setMe(await apiFetch<Me>("/org/me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Settings</h1>
          <p className="vo-muted">Workspace and session details for local development.</p>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!me && !error && <p className="vo-muted">Loading…</p>}
      {me && (
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <div className="vo-panel">
            <div className="vo-panel-label">Signed-in as</div>
            <div className="vo-panel-value">{me.email}</div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">Roles</div>
            <div className="vo-panel-value">
              {me.roles.length
                ? me.roles.map((r) => formatRoleLabel(r)).join(", ")
                : "None"}
            </div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">Organization ID</div>
            <div className="vo-panel-value" style={{ fontSize: 12, wordBreak: "break-all" }}>
              {me.organization?.id ?? "—"}
            </div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">API base URL</div>
            <div className="vo-panel-value" style={{ fontSize: 12 }}>{apiBase}</div>
          </div>
          <p className="vo-muted" style={{ fontSize: 13 }}>
            Clerk session wiring and role assignment UI land in a later pass. Dev mode uses{" "}
            <code>Bearer dev-token</code> when <code>CLERK_JWKS_URL</code> is unset.
          </p>
        </div>
      )}
    </div>
  );
}
