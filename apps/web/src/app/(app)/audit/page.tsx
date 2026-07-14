"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { apiFetch } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; email: string } | null;
};

function AuditTable({ prefix }: { prefix?: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "150" });
      if (prefix) qs.set("prefix", prefix);
      const data = await apiFetch<AuditRow[]>(`/audit?${qs.toString()}`);
      setRows(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    void load();
  }, [load]);

  const { slice, total, page: safePage } = usePageSlice(rows, page);

  if (loading) return <p className="vo-muted">Loading…</p>;
  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (rows.length === 0) {
    return (
      <div className="vo-empty">
        <p className="vo-empty-title">No events yet</p>
        <p className="vo-muted">Credential reveals, creates, and security signals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="vo-table-wrap">
      <table className="vo-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Resource</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td>
              <td><code>{r.action}</code></td>
              <td>{r.actor?.email ?? "—"}</td>
              <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                {r.resourceType ?? "—"}
                {r.resourceId ? ` · ${r.resourceId.slice(0, 8)}…` : ""}
              </td>
              <td>{r.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePagination page={safePage} total={total} onPageChange={setPage} />
    </div>
  );
}

export default function AuditPage() {
  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Audit log</h1>
          <p className="vo-muted">Append-only trail of vault actions in this organization.</p>
        </div>
      </div>
      <Suspense fallback={<p className="vo-muted">Loading…</p>}>
        <AuditTable />
      </Suspense>
    </div>
  );
}
