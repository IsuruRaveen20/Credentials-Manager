"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ModalScrim } from "@/components/modal-scrim";
import { RoleSelect } from "@/components/role-select";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { ASSIGNABLE_ROLES, formatRoleLabel, type AssignableRole } from "@/lib/roles";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  joinedAt: string;
  roles: string[];
};

function formatStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (!s) return status;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function EmployeesPage() {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Member[]>("/employees");
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const res = await apiFetch<{ invitePreviewUrl?: string }>("/employees", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, role }),
      });
      setInviteOpen(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("viewer");
      if (res.invitePreviewUrl) setInviteLink(res.invitePreviewUrl);
      toast.success("Invite sent", email);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      setError(msg);
      toast.error("Invite failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    try {
      const res = await apiFetch<{ invitePreviewUrl?: string }>(`/employees/${id}/resend-invite`, {
        method: "POST",
      });
      if (res.invitePreviewUrl) setInviteLink(res.invitePreviewUrl);
      toast.success("Invite resent");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resend failed";
      setError(msg);
      toast.error("Resend failed", msg);
    }
  }

  async function disable(id: string) {
    try {
      await apiFetch(`/employees/${id}/disable`, { method: "POST" });
      toast.success("Employee disabled");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Disable failed";
      setError(msg);
      toast.error("Disable failed", msg);
    }
  }

  function isOwner(m: Member): boolean {
    return m.roles.includes("owner");
  }

  function primaryRole(m: Member): AssignableRole {
    const hit = ASSIGNABLE_ROLES.find((r) => m.roles.includes(r));
    return hit ?? "viewer";
  }

  async function changeRole(id: string, next: AssignableRole) {
    if (!can(PERMS.ROLE_ASSIGN)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.roleAssign);
      return;
    }
    setRoleBusyId(id);
    setError(null);
    try {
      await apiFetch(`/employees/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      toast.success("Role updated", formatRoleLabel(next));
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Role update failed";
      setError(msg);
      toast.error("Role update failed", msg);
    } finally {
      setRoleBusyId(null);
    }
  }

  const { slice, total, page: safePage } = usePageSlice(rows, page);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Employees</h1>
          <p className="vo-page-sub">Invite people, assign roles, and manage access.</p>
        </div>
        <div className="vo-page-actions">
          <button
            type="button"
            className="vo-btn vo-btn-webmee"
            onClick={() => {
              if (ready && !can(PERMS.EMPLOYEE_INVITE)) {
                toast.error(ACCESS_DENIED.title, ACCESS_DENIED.employeeInvite);
                return;
              }
              setInviteOpen(true);
            }}
          >
            + Invite employee
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="vo-panel" style={{ marginBottom: 16 }}>
          <div className="vo-panel-label">Console invite link (dev)</div>
          <div className="vo-panel-value" style={{ fontSize: 12, wordBreak: "break-all" }}>
            <a href={inviteLink} style={{ color: "var(--brand)" }}>{inviteLink}</a>
          </div>
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}
      {loading && <p className="vo-muted">Loading…</p>}

      {!loading && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slice.map((m) => (
                <tr key={m.id}>
                  <td>{[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{m.email}</td>
                  <td>{formatStatusLabel(m.status)}</td>
                  <td>
                    {isOwner(m) ? (
                      <span className="vo-role-badge vo-role-badge--owner">
                        {formatRoleLabel("owner")}
                      </span>
                    ) : (
                      <RoleSelect
                        value={primaryRole(m)}
                        disabled={
                          roleBusyId === m.id ||
                          m.status === "disabled" ||
                          !can(PERMS.ROLE_ASSIGN)
                        }
                        onChange={(next) => void changeRole(m.id, next)}
                      />
                    )}
                  </td>
                  <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {m.status === "invited" && (
                      <button
                        type="button"
                        className="vo-btn vo-btn-secondary"
                        style={{ marginRight: 6 }}
                        onClick={() => void resend(m.id)}
                      >
                        Resend
                      </button>
                    )}
                    {m.status !== "disabled" && (
                      <button
                        type="button"
                        className="vo-btn vo-btn-secondary"
                        onClick={() => void disable(m.id)}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={safePage} total={total} onPageChange={setPage} />
        </div>
      )}

      {inviteOpen && (
        <ModalScrim onClose={() => setInviteOpen(false)}>
          <div
            className="vo-modal"
            style={{ maxWidth: 440 }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vo-modal-head">
              <h2 className="vo-modal-title">Invite employee</h2>
              <button
                type="button"
                className="vo-close-btn"
                onClick={() => setInviteOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                if (!can(PERMS.EMPLOYEE_INVITE)) {
                  e.preventDefault();
                  toast.error(ACCESS_DENIED.title, ACCESS_DENIED.employeeInvite);
                  return;
                }
                void invite(e);
              }}
            >
              <div className="vo-modal-body">
                <label className="vo-field">
                  <span className="vo-label">First name</span>
                  <input
                    className="vo-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
                <label className="vo-field">
                  <span className="vo-label">Last name</span>
                  <input
                    className="vo-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </label>
                <label className="vo-field">
                  <span className="vo-label">Email</span>
                  <input
                    className="vo-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <div className="vo-field">
                  <span className="vo-label">Role</span>
                  <RoleSelect value={role} onChange={setRole} />
                </div>
              </div>
              <div className="vo-modal-actions">
                <button
                  type="button"
                  className="vo-btn vo-btn-ghost"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="vo-btn vo-btn-webmee" disabled={busy}>
                  {busy ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </ModalScrim>
      )}
    </div>
  );
}
