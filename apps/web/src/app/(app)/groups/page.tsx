"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ModalScrim } from "@/components/modal-scrim";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
  sharedCredentialCount: number;
  createdAt: string;
};

type GroupMember = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

type GroupDetail = Group & { members: GroupMember[] };

type Employee = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

const SWATCHES = ["#7C5CFC", "#3DA9FC", "#3DDC97", "#F2B84B", "#F26D6D", "#8A94A6"];

function personName(p: { firstName: string | null; lastName: string | null; email: string }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
}

function GroupDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: 999,
        background: color || "var(--fg-3)",
        flexShrink: 0,
      }}
    />
  );
}

export default function GroupsPage() {
  const toast = useToast();
  const { can, ready } = useAccess();
  const canManage = can(PERMS.GROUP_MANAGE);

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);

  // Members modal
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Group[]>("/groups");
      setGroups(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    if (ready && !canManage) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.groupManage);
      return;
    }
    setEditing(null);
    setName("");
    setDescription("");
    setColor(SWATCHES[0]);
    setFormOpen(true);
  }

  function openEdit(g: Group) {
    if (!canManage) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.groupManage);
      return;
    }
    setEditing(g);
    setName(g.name);
    setDescription(g.description ?? "");
    setColor(g.color ?? SWATCHES[0]);
    setFormOpen(true);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/groups/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description, color }),
        });
        toast.success("Group updated", name);
      } else {
        await apiFetch("/groups", {
          method: "POST",
          body: JSON.stringify({ name, description, color }),
        });
        toast.success("Group created", name);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error("Save failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(g: Group) {
    if (!canManage) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.groupManage);
      return;
    }
    if (!window.confirm(`Delete "${g.name}"? Records shared with this group will lose that access.`)) {
      return;
    }
    try {
      await apiFetch(`/groups/${g.id}`, { method: "DELETE" });
      toast.success("Group deleted", g.name);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error("Delete failed", msg);
    }
  }

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await apiFetch<GroupDetail>(`/groups/${id}`);
      setDetail(d);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load group";
      toast.error("Load failed", msg);
    }
  }, [toast]);

  function openMembers(g: Group) {
    setMembersGroup(g);
    setMemberSearch("");
    void loadDetail(g.id);
    void apiFetch<Employee[]>("/employees")
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }

  const memberIds = useMemo(() => new Set(detail?.members.map((m) => m.id) ?? []), [detail]);

  const filteredEmployees = employees.filter((e) => {
    if (e.status === "disabled") return false;
    const q = memberSearch.toLowerCase();
    if (!q) return true;
    return personName(e).toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  });

  async function toggleMember(employee: Employee, isMember: boolean) {
    if (!membersGroup) return;
    if (!canManage) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.groupManage);
      return;
    }
    setMemberBusyId(employee.id);
    try {
      if (isMember) {
        await apiFetch(`/groups/${membersGroup.id}/members/${employee.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/groups/${membersGroup.id}/members`, {
          method: "POST",
          body: JSON.stringify({ userId: employee.id }),
        });
      }
      await loadDetail(membersGroup.id);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toast.error("Update failed", msg);
    } finally {
      setMemberBusyId(null);
    }
  }

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Groups</h1>
          <p className="vo-page-sub">
            Organize employees into teams — Senior developers, Junior developers, New developers,
            or your own — then share vault records with the whole group in one click.
          </p>
        </div>
        <div className="vo-page-actions">
          <button type="button" className="vo-btn vo-btn-webmee" onClick={openCreate}>
            + Create group
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}
      {loading && <p className="vo-muted">Loading…</p>}

      {!loading && groups.length === 0 && (
        <div className="vo-panel">
          <p className="vo-muted" style={{ fontSize: 13 }}>
            No groups yet. Create one to start sharing vault records with a whole team at once.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Description</th>
                <th>Members</th>
                <th>Shared records</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <GroupDot color={g.color} />
                      {g.name}
                    </span>
                  </td>
                  <td style={{ color: "var(--fg-2)", maxWidth: 340 }}>{g.description || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="vo-btn vo-btn-secondary"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openMembers(g)}
                    >
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </button>
                  </td>
                  <td>{g.sharedCredentialCount}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="vo-btn vo-btn-secondary"
                      style={{ marginRight: 6 }}
                      onClick={() => openEdit(g)}
                    >
                      Edit
                    </button>
                    <button type="button" className="vo-btn vo-btn-secondary" onClick={() => void removeGroup(g)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <ModalScrim onClose={() => setFormOpen(false)}>
          <div className="vo-modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="vo-modal-head">
              <h2 className="vo-modal-title">{editing ? "Edit group" : "Create group"}</h2>
              <button type="button" className="vo-close-btn" onClick={() => setFormOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void submitForm(e)}>
              <div className="vo-modal-body">
                <label className="vo-field">
                  <span className="vo-label">Name</span>
                  <input
                    className="vo-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Senior Developers"
                    required
                  />
                </label>
                <label className="vo-field">
                  <span className="vo-label">Description (optional)</span>
                  <textarea
                    className="vo-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Who's in this group and what they typically need access to"
                  />
                </label>
                <div className="vo-field">
                  <span className="vo-label">Badge color</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {SWATCHES.map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => setColor(sw)}
                        aria-label={`Use color ${sw}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          background: sw,
                          border: color === sw ? "2px solid var(--fg-1)" : "2px solid transparent",
                          outline: color === sw ? "2px solid var(--bg-elev-1)" : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="vo-modal-actions">
                <button type="button" className="vo-btn vo-btn-ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vo-btn vo-btn-webmee" disabled={busy}>
                  {busy ? "Saving…" : editing ? "Save changes" : "Create group"}
                </button>
              </div>
            </form>
          </div>
        </ModalScrim>
      )}

      {membersGroup && (
        <ModalScrim onClose={() => setMembersGroup(null)}>
          <div className="vo-modal" style={{ maxWidth: 480 }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="vo-modal-head">
              <h2 className="vo-modal-title">
                <GroupDot color={membersGroup.color} /> {membersGroup.name} members
              </h2>
              <button type="button" className="vo-close-btn" onClick={() => setMembersGroup(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="vo-modal-body">
              <input
                className="vo-input"
                placeholder="Search employees…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <div style={{ maxHeight: 320, overflow: "auto", display: "grid", gap: 2 }}>
                {filteredEmployees.map((e) => {
                  const isMember = memberIds.has(e.id);
                  return (
                    <label
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 4px",
                        cursor: canManage ? "pointer" : "default",
                        borderBottom: "1px solid var(--hairline)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isMember}
                        disabled={!canManage || memberBusyId === e.id}
                        onChange={() => void toggleMember(e, isMember)}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{personName(e)}</div>
                        <div className="vo-muted" style={{ fontSize: 11 }}>{e.email}</div>
                      </div>
                    </label>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <p className="vo-muted" style={{ fontSize: 12 }}>No matching employees.</p>
                )}
              </div>
            </div>
            <div className="vo-modal-actions">
              <button type="button" className="vo-btn vo-btn-webmee" onClick={() => setMembersGroup(null)}>
                Done
              </button>
            </div>
          </div>
        </ModalScrim>
      )}
    </div>
  );
}
