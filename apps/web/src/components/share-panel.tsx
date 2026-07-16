"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

type ShareRow = {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type GroupShareRow = {
  id: string;
  groupId: string;
  name: string;
  color: string | null;
  memberCount: number;
};

type SharesResponse = {
  count: number;
  shares: ShareRow[];
  groupCount: number;
  groups: GroupShareRow[];
};

type Employee = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

type Group = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
};

function GroupDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color || "var(--fg-3)",
        flexShrink: 0,
      }}
    />
  );
}

export function SharePanel({ credentialId }: { credentialId: string }) {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [count, setCount] = useState(0);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [groupShares, setGroupShares] = useState<GroupShareRow[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SharesResponse>(`/credentials/${credentialId}/shares`);
      setCount(data.count);
      setShares(data.shares);
      setGroupShares(data.groups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shares");
    }
  }, [credentialId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiFetch<Group[]>("/groups")
      .then(setAllGroups)
      .catch(() => setAllGroups([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    void apiFetch<Employee[]>("/employees")
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, [open]);

  const sharedIds = useMemo(() => new Set(shares.map((s) => s.userId)), [shares]);
  const sharedGroupIds = useMemo(() => new Set(groupShares.map((g) => g.groupId)), [groupShares]);

  const filtered = employees.filter((e) => {
    if (e.status !== "active" || sharedIds.has(e.id)) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${e.firstName ?? ""} ${e.lastName ?? ""} ${e.email}`.toLowerCase();
    return name.includes(q);
  });

  function requireShareAccess(): boolean {
    if (ready && !can(PERMS.CREDENTIAL_SHARE)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.credentialShare);
      return false;
    }
    return true;
  }

  async function shareWith(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/credentials/${credentialId}/shares`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setSearch("");
      toast.success("Access shared");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Share failed";
      setError(msg);
      toast.error("Share failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setBusy(true);
    try {
      await apiFetch(`/credentials/${credentialId}/shares/${userId}`, { method: "DELETE" });
      toast.success("Access revoked");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Revoke failed";
      setError(msg);
      toast.error("Revoke failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function toggleGroup(group: Group, isShared: boolean) {
    if (!requireShareAccess()) return;
    setGroupBusyId(group.id);
    setError(null);
    try {
      if (isShared) {
        await apiFetch(`/credentials/${credentialId}/shares/groups/${group.id}`, {
          method: "DELETE",
        });
        toast.success("Group access revoked", group.name);
      } else {
        await apiFetch(`/credentials/${credentialId}/shares/groups`, {
          method: "POST",
          body: JSON.stringify({ groupId: group.id }),
        });
        toast.success("Shared with group", group.name);
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setError(msg);
      toast.error("Update failed", msg);
    } finally {
      setGroupBusyId(null);
    }
  }

  return (
    <div className="vo-sidecard" style={{ marginBottom: 12 }}>
      <div className="vo-sidecard-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Shared access</span>
        <span className="vo-muted" style={{ fontSize: 12 }}>
          {count} {count === 1 ? "person" : "people"} · {groupShares.length} {groupShares.length === 1 ? "group" : "groups"}
        </span>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 12, padding: "0 14px 8px" }}>{error}</p>
      )}

      {allGroups.length > 0 && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--hairline)" }}>
          <div className="vo-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Groups
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {allGroups.map((g) => {
              const isShared = sharedGroupIds.has(g.id);
              return (
                <label
                  key={g.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 0",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isShared}
                    disabled={groupBusyId === g.id}
                    onChange={() => void toggleGroup(g, isShared)}
                  />
                  <GroupDot color={g.color} />
                  <span style={{ flex: 1, minWidth: 0 }}>{g.name}</span>
                  <span className="vo-muted" style={{ fontSize: 11 }}>
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: "8px 14px", display: "grid", gap: 8 }}>
        <div className="vo-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          People
        </div>
        {shares.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>
                {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
              </div>
              <div className="vo-muted" style={{ fontSize: 11 }}>{s.email}</div>
            </div>
            <button
              type="button"
              className="vo-btn vo-btn-secondary"
              style={{ fontSize: 11, padding: "4px 8px" }}
              disabled={busy}
              onClick={() => void revoke(s.userId)}
            >
              Remove
            </button>
          </div>
        ))}
        {shares.length === 0 && <p className="vo-muted" style={{ fontSize: 12 }}>Not shared with anyone individually.</p>}

        <button
          type="button"
          className="vo-btn vo-btn-webmee"
          onClick={() => {
            if (!requireShareAccess()) return;
            setOpen((v) => !v);
          }}
        >
          {open ? "Close" : "Share…"}
        </button>

        {open && (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              className="vo-input"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ maxHeight: 160, overflow: "auto", display: "grid", gap: 4 }}>
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="vo-btn vo-btn-secondary"
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                  disabled={busy}
                  onClick={() => void shareWith(e.id)}
                >
                  {[e.firstName, e.lastName].filter(Boolean).join(" ") || e.email}
                  <span className="vo-muted" style={{ marginLeft: 8, fontSize: 11 }}>{e.email}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="vo-muted" style={{ fontSize: 12 }}>No matching active employees.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
