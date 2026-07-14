"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCategoryLabel } from "@/lib/categories";

type Cred = { id: string; name: string; category: string; username: string | null; host?: string | null };

export const COMMAND_PALETTE_OPEN_EVENT = "vaultops:open-command-palette";

const PAGES: { href: string; label: string; keywords: string }[] = [
  { href: "/dashboard", label: "Dashboard", keywords: "home overview" },
  { href: "/vault", label: "Vault", keywords: "credentials secrets passwords" },
  { href: "/categories", label: "Credential categories", keywords: "tags labels" },
  { href: "/audit", label: "Audit log", keywords: "history events" },
  { href: "/threats", label: "Threat alerts", keywords: "security suspicious" },
  { href: "/encryption", label: "Encryption status", keywords: "kms aes" },
  { href: "/employees", label: "Employees", keywords: "users invite roles team" },
  { href: "/roles", label: "Roles", keywords: "permissions access admin editor viewer auditor" },
  { href: "/settings", label: "Settings", keywords: "account" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creds, setCreds] = useState<Cred[]>([]);
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    try {
      setCreds(await apiFetch<Cred[]>("/credentials"));
    } catch {
      setCreds([]);
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      void load();
    }
  }, [open, load]);

  const needle = q.trim().toLowerCase();

  const items = useMemo(() => {
    const pages = PAGES.filter(
      (p) =>
        !needle ||
        p.label.toLowerCase().includes(needle) ||
        p.keywords.includes(needle),
    ).map((p) => ({
      key: `page:${p.href}`,
      label: p.label,
      hint: "Go to page",
      href: p.href,
    }));
    const matches = creds
      .filter((c) => {
        if (!needle) return true;
        return (
          c.name.toLowerCase().includes(needle) ||
          formatCategoryLabel(c.category).toLowerCase().includes(needle) ||
          (c.username ?? "").toLowerCase().includes(needle) ||
          (c.host ?? "").toLowerCase().includes(needle)
        );
      })
      .slice(0, 12)
      .map((c) => ({
        key: `cred:${c.id}`,
        label: c.name,
        hint: formatCategoryLabel(c.category) + (c.host ? ` · ${c.host}` : ""),
        href: `/vault/${c.id}`,
      }));
    return [...pages, ...matches];
  }, [creds, needle]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active].href);
    }
  }

  if (!open) return null;

  return (
    <div className="vo-scrim vo-cmdk-scrim" onClick={() => setOpen(false)}>
      <div
        className="vo-cmdk"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="vo-cmdk-input"
          placeholder="Search pages and credentials…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <div className="vo-cmdk-list">
          {items.length === 0 && (
            <div className="vo-cmdk-empty">No matches</div>
          )}
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={`vo-cmdk-item ${i === active ? "active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item.href)}
            >
              <span>{item.label}</span>
              <span className="vo-muted">{item.hint}</span>
            </button>
          ))}
        </div>
        <div className="vo-cmdk-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
