"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { apiFetch } from "@/lib/api";
import { formatCategoryLabel } from "@/lib/categories";

type CredentialRow = {
  id: string;
  name: string;
  category: string;
  username: string | null;
  updatedAt: string;
};

export default function SshKeysPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CredentialRow[]>("/credentials");
      setRows(
        data.filter((r) => formatCategoryLabel(r.category).toLowerCase() === "ssh"),
      );
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SSH keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { slice, total, page: safePage } = usePageSlice(rows, page);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">SSH keys</h1>
          <p className="vo-muted">
            Filtered vault view — SSH credentials only. Same records as vault with category{" "}
            <Link href="/vault?category=Ssh" style={{ color: "var(--brand)" }}>Ssh</Link>.
          </p>
        </div>
        <Link href="/vault?category=Ssh" className="vo-btn-secondary">
          Open in vault
        </Link>
      </div>

      {loading && <p className="vo-muted">Loading…</p>}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <div className="vo-empty">
          <p className="vo-empty-title">No SSH credentials</p>
          <p className="vo-muted">
            Add a credential with category <code>Ssh</code> (or <code>ssh</code>) from the vault.
          </p>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/vault/${r.id}`} style={{ color: "var(--brand)" }}>
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.username ?? "—"}</td>
                  <td>{new Date(r.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={safePage} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
