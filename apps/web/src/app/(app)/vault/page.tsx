"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AddCredentialDialog } from "@/components/add-credential-dialog";
import { TablePagination, usePageSlice } from "@/components/table-pagination";
import { PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { categoryColor, formatCategoryLabel, PRESET_CREDENTIAL_CATEGORIES } from "@/lib/categories";

type CredentialRow = {
  id: string;
  name: string;
  category: string;
  loginKind?: string;
  username: string | null;
  logoDataUrl?: string | null;
  tags: string[];
  notesPresent: boolean;
  shareCount?: number;
  createdAt: string;
  updatedAt: string;
};

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
}
function GridIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function ListIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function ShieldCheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}
function VaultEmptyIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 16v2"/></svg>;
}

function categoryKey(c: string) {
  return formatCategoryLabel(c).toLowerCase();
}

function CredLogo({
  src,
  name,
  category,
  size = "sm",
}: {
  src?: string | null;
  name: string;
  category: string;
  size?: "sm" | "md";
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  if (src) {
    return (
      <span className={`vo-cred-logo vo-cred-logo--${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" />
      </span>
    );
  }
  return (
    <span
      className={`vo-cred-logo vo-cred-logo--${size} vo-cred-logo--fallback`}
      style={{ background: categoryColor(category) }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function VaultPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAccess();
  const categoryFromUrl = searchParams.get("category");
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(categoryFromUrl ?? "all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const categoryChips = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const preset of PRESET_CREDENTIAL_CATEGORIES) {
      byKey.set(categoryKey(preset), preset);
    }
    for (const r of rows) {
      byKey.set(categoryKey(r.category), formatCategoryLabel(r.category));
    }
    return ["all", ...Array.from(byKey.values()).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  useEffect(() => {
    if (categoryFromUrl) {
      setFilter(categoryFromUrl);
    } else {
      setFilter("all");
    }
    setPage(1);
  }, [categoryFromUrl]);

  const setCategory = (cat: string) => {
    setFilter(cat);
    setPage(1);
    if (cat === "all") {
      router.replace("/vault");
    } else {
      router.replace(`/vault?category=${encodeURIComponent(cat)}`);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CredentialRow[]>("/credentials");
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesFilter =
        filter === "all" || categoryKey(r.category) === categoryKey(filter);
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        formatCategoryLabel(r.category).toLowerCase().includes(q) ||
        (r.username ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [rows, filter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, view]);

  const { slice, total, page: safePage } = usePageSlice(filtered, page);

  const chipActive = (cat: string) =>
    cat === "all" ? filter === "all" : categoryKey(filter) === categoryKey(cat);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Vault</h1>
          <p className="vo-page-sub">
            {search.trim()
              ? `${filtered.length} of ${rows.length} credential${rows.length !== 1 ? "s" : ""} match`
              : `${rows.length} credential${rows.length !== 1 ? "s" : ""} · all encrypted with AES-256-GCM`}
          </p>
        </div>
        <div className="vo-page-actions">
          <AddCredentialDialog onCreated={load} />
        </div>
      </div>

      <div className="vo-toolbar">
        <div className="vo-chip-row">
          {categoryChips.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`vo-chip ${chipActive(cat) ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat === "all" ? "All" : formatCategoryLabel(cat)}
            </button>
          ))}
        </div>
        <div className="vo-toolbar-tools">
          <div className="vo-vault-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search name, category, username, tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Filter credentials"
            />
          </div>
          <div className="vo-view-toggle">
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              <ListIcon />
            </button>
            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
              <GridIcon />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0", color: "var(--fg-3)" }}>
          <div className="vo-spinner" />
          <span style={{ fontSize: 13 }}>Loading vault…</span>
        </div>
      )}

      {error && (
        <div className="vo-card" style={{ borderColor: "rgba(224,70,74,0.3)", background: "rgba(224,70,74,0.06)" }}>
          <p style={{ fontSize: 13, color: "var(--red-400)" }}>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="vo-empty">
          <VaultEmptyIcon />
          <p className="vo-empty-title">
            {rows.length === 0 ? "No credentials yet" : "Nothing matches this search"}
          </p>
          <p style={{ fontSize: 12 }}>
            {rows.length === 0
              ? can(PERMS.CREDENTIAL_WRITE)
                ? "Add your first credential to get started."
                : "Nothing in the vault yet — or ask an admin to share credentials with you."
              : "Try another category or clear the search box."}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && view === "list" && (
        <div className="vo-table-wrap">
          <table className="vo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Username</th>
                <th>Shared</th>
                <th>Tags</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/vault/${r.id}`)}>
                  <td>
                    <div className="vo-table-name">
                      <CredLogo src={r.logoDataUrl} name={r.name} category={r.category} />
                      <div>
                        <div className="vo-table-title">{r.name}</div>
                        <div className="vo-table-sub">{formatCategoryLabel(r.category)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="vo-badge vo-badge-neutral" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {formatCategoryLabel(r.category)}
                    </span>
                  </td>
                  <td>
                    <span className="vo-table-meta">
                      {r.loginKind === "email" ? "email · " : r.loginKind === "none" ? "secret · " : ""}
                      {r.username ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className="vo-table-meta">{r.shareCount ?? 0}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.tags.slice(0, 3).map((t) => (
                        <span key={t} className="vo-tag">
                          {t}
                        </span>
                      ))}
                      {r.tags.length === 0 && <span style={{ color: "var(--fg-3)", fontSize: 12 }}>—</span>}
                    </div>
                  </td>
                  <td>
                    <span className="vo-table-meta">{new Date(r.updatedAt).toLocaleDateString()}</span>
                  </td>
                  <td>
                    <span className="vo-badge vo-badge-secure">
                      <span className="vo-badge-dot" />
                      Encrypted
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={safePage} total={total} onPageChange={setPage} />
        </div>
      )}

      {!loading && !error && filtered.length > 0 && view === "grid" && (
        <>
          <div className="vo-grid">
            {slice.map((r) => (
              <button key={r.id} type="button" className="vo-grid-card" onClick={() => router.push(`/vault/${r.id}`)}>
                <div className="vo-grid-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <CredLogo src={r.logoDataUrl} name={r.name} category={r.category} size="md" />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                      {formatCategoryLabel(r.category)}
                    </span>
                  </div>
                  <span className="vo-badge vo-badge-secure" style={{ fontSize: 10, padding: "2px 6px" }}>
                    <span className="vo-badge-dot" />
                    Encrypted
                  </span>
                </div>
                <div className="vo-grid-title">{r.name}</div>
                <div className="vo-grid-svc" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                  {r.username ?? (r.loginKind === "none" ? "Secret only" : "No identity")} ·{" "}
                  {formatCategoryLabel(r.category)}
                </div>
                {r.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t} className="vo-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="vo-grid-foot">
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <ShieldCheckIcon />
                    <span style={{ fontSize: 11, color: "var(--emerald-400)" }}>Secure</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="vo-table-wrap" style={{ marginTop: 12 }}>
            <TablePagination page={safePage} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={<p className="vo-muted">Loading vault…</p>}>
      <VaultPageInner />
    </Suspense>
  );
}
