"use client";

import { useCallback, useEffect, useState } from "react";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { apiFetch } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  actor: { id: string; email: string } | null;
};

export default function ThreatsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AuditRow[]>("/audit?limit=200");
      setRows(
        data.filter(
          (r) => r.action === "security.suspicious" || r.action === "auth.denied",
        ),
      );
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load threats");
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
          <h1 className="vo-page-title">Threat alerts</h1>
          <p className="vo-muted">
            Suspicious reveal velocity and auth denials. Threshold is controlled by{" "}
            <code>SUSPICIOUS_REVEAL_THRESHOLD</code>.
          </p>
        </div>
      </div>

      {loading && <p className="vo-muted">Loading…</p>}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <div className="vo-empty">
          <p className="vo-empty-title">No active threats</p>
          <p className="vo-muted">When reveal denials spike or auth is blocked, signals show up here.</p>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Signal</th>
                <th>Actor</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td><code>{r.action}</code></td>
                  <td>{r.actor?.email ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.resourceType ?? "—"}
                    {r.metadata ? ` · ${JSON.stringify(r.metadata)}` : ""}
                  </td>
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
