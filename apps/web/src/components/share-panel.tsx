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

type Employee = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

export function SharePanel({ credentialId }: { credentialId: string }) {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [count, setCount] = useState(0);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number; shares: ShareRow[] }>(
        `/credentials/${credentialId}/shares`,
      );
      setCount(data.count);
      setShares(data.shares);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shares");
    }
  }, [credentialId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void apiFetch<Employee[]>("/employees")
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, [open]);

  const sharedIds = useMemo(() => new Set(shares.map((s) => s.userId)), [shares]);
  const filtered = employees.filter((e) => {
    if (e.status !== "active" || sharedIds.has(e.id)) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${e.firstName ?? ""} ${e.lastName ?? ""} ${e.email}`.toLowerCase();
    return name.includes(q);
  });

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

  return (
    <div className="vo-sidecard" style={{ marginBottom: 12 }}>
      <div className="vo-sidecard-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Shared access</span>
        <span className="vo-muted" style={{ fontSize: 12 }}>{count} people</span>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 12, padding: "0 14px 8px" }}>{error}</p>
      )}

      <div style={{ padding: "8px 14px", display: "grid", gap: 8 }}>
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
        {shares.length === 0 && <p className="vo-muted" style={{ fontSize: 12 }}>Not shared yet.</p>}

        <button
          type="button"
          className="vo-btn vo-btn-webmee"
          onClick={() => {
            if (ready && !can(PERMS.CREDENTIAL_SHARE)) {
              toast.error(ACCESS_DENIED.title, ACCESS_DENIED.credentialShare);
              return;
            }
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
