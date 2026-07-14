"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { categoryColor, formatCategoryLabel } from "@/lib/categories";

type CategoryRow = {
  id: string;
  name: string;
  credentialCount: number;
  createdAt: string;
  updatedAt: string;
  isPreset: boolean;
};

export default function CategoriesPage() {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<CategoryRow[]>("/categories"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!can(PERMS.CREDENTIAL_WRITE)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.categoryWrite);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      setOpen(false);
      setPage(1);
      toast.success("Category added", formatCategoryLabel(name.trim()));
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add category";
      setError(msg);
      toast.error("Could not add category", msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!can(PERMS.CREDENTIAL_WRITE)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.categoryWrite);
      return;
    }
    setError(null);
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      toast.success("Category deleted");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete category";
      setError(msg);
      toast.error("Could not delete category", msg);
    }
  }

  const { slice, total, page: safePage } = usePageSlice(rows, page);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Credential categories</h1>
          <p className="vo-muted">
            Manage labels used when saving credentials. Add a name only — presets are included.
          </p>
        </div>
        <div className="vo-page-actions">
          <button
            type="button"
            className="vo-btn vo-btn-webmee"
            onClick={() => {
              if (ready && !can(PERMS.CREDENTIAL_WRITE)) {
                toast.error(ACCESS_DENIED.title, ACCESS_DENIED.categoryWrite);
                return;
              }
              setOpen(true);
            }}
          >
            + Add category
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--fg-danger)", marginBottom: 12 }}>{error}</p>}
      {loading && <p className="vo-muted">Loading…</p>}

      {!loading && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Credentials</th>
                <th>Type</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id} style={{ cursor: "default" }}>
                  <td>
                    <div className="vo-table-name">
                      <span className="vo-sb-cat-dot" style={{ background: categoryColor(r.name) }} />
                      <div>
                        <div className="vo-table-title">{formatCategoryLabel(r.name)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/vault?category=${encodeURIComponent(r.name)}`}
                      className="vo-table-meta"
                      style={{ color: "var(--wm-teal)" }}
                    >
                      {r.credentialCount}
                    </Link>
                  </td>
                  <td>
                    <span className="vo-badge vo-badge-neutral">
                      {r.isPreset ? "Preset" : "Custom"}
                    </span>
                  </td>
                  <td>
                    <span className="vo-table-meta">{new Date(r.updatedAt).toLocaleDateString()}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {!r.isPreset && r.credentialCount === 0 && (
                      <button
                        type="button"
                        className="vo-btn vo-btn-secondary vo-btn-sm"
                        onClick={() => void onDelete(r.id)}
                      >
                        Delete
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

      {open && (
        <div className="vo-scrim" onClick={() => setOpen(false)}>
          <div className="vo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="vo-modal-head">
              <h2 className="vo-modal-title">Add category</h2>
              <button type="button" className="vo-close-btn" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={onCreate}>
              <div className="vo-modal-body">
                <label className="vo-field">
                  <span className="vo-label">Category name</span>
                  <input
                    className="vo-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Registrar, Staging"
                    required
                    autoFocus
                  />
                </label>
              </div>
              <div className="vo-modal-actions">
                <button type="button" className="vo-btn vo-btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="vo-btn vo-btn-webmee" disabled={busy || !name.trim()}>
                  {busy ? "Saving…" : "Save category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
