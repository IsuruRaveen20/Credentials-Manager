"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { categoryColor, formatCategoryLabel } from "@/lib/categories";

type Stats = {
  credentials: { total: number; byCategory: { category: string; count: number }[] };
  employees: { active: number; invited: number; total: number };
  shares: { grantedByYou: number; sharedWithYou: number };
  threatsLast7Days: number;
  recentAudit: {
    id: string;
    action: string;
    actorEmail: string | null;
    createdAt: string;
  }[];
};

type CredentialRow = {
  id: string;
  name: string;
  category: string;
  expiresAt?: string | null;
};

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now() + EXPIRY_WINDOW_MS;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, creds] = await Promise.all([
        apiFetch<Stats>("/dashboard/stats"),
        apiFetch<CredentialRow[]>("/credentials"),
      ]);
      setStats(s);
      setCredentials(creds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const expiringSoon = useMemo(() => {
    return credentials
      .filter((c) => isExpiringSoon(c.expiresAt))
      .sort((a, b) => {
        const ta = new Date(a.expiresAt!).getTime();
        const tb = new Date(b.expiresAt!).getTime();
        return ta - tb;
      })
      .slice(0, 8);
  }, [credentials]);

  return (
    <div className="vo-dash">
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Dashboard</h1>
          <p className="vo-muted">
            Organization overview for credentials, people, and recent activity.
          </p>
        </div>
        <div className="vo-page-actions">
          <Link href="/vault" className="vo-btn vo-btn-primary">
            Open vault
          </Link>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger, var(--fg-danger))" }}>{error}</p>}
      {!stats && !error && <p className="vo-muted">Loading…</p>}

      {stats && (
        <>
          <div className="vo-dash-stats">
            <div className="vo-panel vo-dash-stat">
              <div className="vo-panel-label">Credentials</div>
              <div className="vo-panel-value vo-dash-stat-num">{stats.credentials.total}</div>
            </div>
            <div className="vo-panel vo-dash-stat">
              <div className="vo-panel-label">Employees</div>
              <div className="vo-panel-value vo-dash-stat-num">{stats.employees.total}</div>
              <div className="vo-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {stats.employees.active} active · {stats.employees.invited} invited
              </div>
            </div>
            <div className="vo-panel vo-dash-stat">
              <div className="vo-panel-label">Shares</div>
              <div className="vo-panel-value vo-dash-stat-num">
                {stats.shares.grantedByYou + stats.shares.sharedWithYou}
              </div>
              <div className="vo-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {stats.shares.grantedByYou} granted · {stats.shares.sharedWithYou} received
              </div>
            </div>
            <div className="vo-panel vo-dash-stat">
              <div className="vo-panel-label">Threats (7d)</div>
              <div className="vo-panel-value vo-dash-stat-num">{stats.threatsLast7Days}</div>
            </div>
          </div>

          <div className="vo-dash-grid">
            <div className="vo-sidecard">
              <div className="vo-sidecard-head">By category</div>
              <div className="vo-sidecard-body">
                {stats.credentials.byCategory.length === 0 && (
                  <p className="vo-muted" style={{ margin: 0 }}>
                    No credentials yet. Categories appear when you add credentials in the vault.
                  </p>
                )}
                <ul className="vo-dash-list">
                  {stats.credentials.byCategory.map((c) => (
                    <li key={c.category} className="vo-dash-list-row">
                      <span className="vo-dash-list-main">
                        <span
                          className="vo-sb-cat-dot"
                          style={{ background: categoryColor(c.category) }}
                        />
                        <Link
                          href={`/vault?category=${encodeURIComponent(c.category)}`}
                          className="vo-dash-cat-link"
                        >
                          {formatCategoryLabel(c.category)}
                        </Link>
                      </span>
                      <span className="vo-muted vo-dash-list-count">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="vo-sidecard">
              <div className="vo-sidecard-head">Recent activity</div>
              <div className="vo-sidecard-body">
                {stats.recentAudit.length === 0 && (
                  <p className="vo-muted" style={{ margin: 0 }}>No events yet.</p>
                )}
                <ul className="vo-dash-list">
                  {stats.recentAudit.map((a) => (
                    <li key={a.id} className="vo-dash-list-row vo-dash-list-row--stack">
                      <code className="vo-dash-action">{a.action}</code>
                      <div className="vo-muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {a.actorEmail ?? "—"} · {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {expiringSoon.length > 0 && (
            <div className="vo-sidecard" style={{ marginTop: 16 }}>
              <div className="vo-sidecard-head">Expiring soon</div>
              <div className="vo-sidecard-body">
                <p className="vo-muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                  Credentials expiring within 30 days or already past expiry.
                </p>
                <ul className="vo-dash-list">
                  {expiringSoon.map((c) => {
                    const exp = new Date(c.expiresAt!);
                    const past = exp.getTime() < Date.now();
                    return (
                      <li key={c.id} className="vo-dash-list-row">
                        <span className="vo-dash-list-main">
                          <Link href={`/vault/${c.id}`} className="vo-dash-cat-link">
                            {c.name}
                          </Link>
                          <span className="vo-muted" style={{ fontSize: 11, marginLeft: 8 }}>
                            {formatCategoryLabel(c.category)}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: past ? "var(--red-400)" : "var(--amber-400, var(--fg-2))",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {past ? "Expired " : ""}
                          {exp.toLocaleDateString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
