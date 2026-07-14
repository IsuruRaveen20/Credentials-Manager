"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { CommandPalette, COMMAND_PALETTE_OPEN_EVENT } from "@/components/command-palette";
import { LogoutButton } from "@/components/logout-button";
import { useTheme } from "@/components/theme-provider";
import { formatRoleLabel } from "@/lib/roles";
import { apiFetch, hasSessionToken } from "@/lib/api";

function SearchIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
}
function VaultIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 16v2"/></svg>;
}
function AuditIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>;
}
function ShieldIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}
function TeamIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="7" r="4"/><circle cx="17" cy="9" r="3"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M22 17a5 5 0 0 0-9.3-2.5"/></svg>;
}
function SettingsIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
}
function AlertIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
}
function DashboardIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
}
function FolderIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
}
function SunIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
}
function MoonIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z"/></svg>;
}
function MenuIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function CloseIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type Me = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  organization: { id: string; name: string } | null;
};

interface SbItem {
  href: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  label: string;
  match: (pathname: string) => boolean;
}

function RolesIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 16c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2" />
    </svg>
  );
}

const WORKSPACE_NAV: SbItem[] = [
  { href: "/dashboard", Icon: DashboardIcon, label: "Dashboard", match: (p) => p.startsWith("/dashboard") },
  { href: "/vault", Icon: VaultIcon, label: "Vault", match: (p) => p === "/vault" || p.startsWith("/vault/") },
  { href: "/categories", Icon: FolderIcon, label: "Credential categories", match: (p) => p.startsWith("/categories") },
  { href: "/employees", Icon: TeamIcon, label: "Employees", match: (p) => p.startsWith("/employees") },
  { href: "/roles", Icon: RolesIcon, label: "Roles", match: (p) => p.startsWith("/roles") },
];

const SECURITY_NAV: SbItem[] = [
  { href: "/encryption", Icon: ShieldIcon, label: "Encryption status", match: (p) => p.startsWith("/encryption") },
  { href: "/audit", Icon: AuditIcon, label: "Audit log", match: (p) => p.startsWith("/audit") },
  { href: "/threats", Icon: AlertIcon, label: "Threat alerts", match: (p) => p.startsWith("/threats") },
];

const TITLE_BY_PATH: { test: (p: string) => boolean; title: string }[] = [
  { test: (p) => p.startsWith("/dashboard"), title: "Dashboard" },
  { test: (p) => p.startsWith("/vault/"), title: "Credential" },
  { test: (p) => p === "/vault", title: "Vault" },
  { test: (p) => p.startsWith("/categories"), title: "Credential categories" },
  { test: (p) => p.startsWith("/audit"), title: "Audit log" },
  { test: (p) => p.startsWith("/threats"), title: "Threat alerts" },
  { test: (p) => p.startsWith("/encryption"), title: "Encryption status" },
  { test: (p) => p.startsWith("/employees"), title: "Employees" },
  { test: (p) => p.startsWith("/roles"), title: "Roles" },
  { test: (p) => p.startsWith("/ssh-keys"), title: "SSH keys" },
  { test: (p) => p.startsWith("/settings"), title: "Settings" },
];

function initials(me: Me | null): string {
  if (!me) return "?";
  const a = (me.firstName?.[0] ?? me.email[0] ?? "?").toUpperCase();
  const b = (me.lastName?.[0] ?? "").toUpperCase();
  return (a + b) || "?";
}

function displayName(me: Me | null): string {
  if (!me) return "Guest";
  const n = [me.firstName, me.lastName].filter(Boolean).join(" ");
  return n || me.email;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { theme, toggleTheme } = useTheme();
  const crumb = TITLE_BY_PATH.find((t) => t.test(pathname))?.title ?? "Workspace";
  const navId = useId();
  const [me, setMe] = useState<Me | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);

  const loadMe = useCallback(async () => {
    try {
      setMe(await apiFetch<Me>("/org/me"));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    setHasToken(hasSessionToken());
    setSessionReady(true);
    void loadMe();
  }, [loadMe, pathname]);

  // Close drawer on navigation
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape + body scroll lock
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen, closeNav]);

  const signedIn = sessionReady && (Boolean(me) || hasToken);
  const orgName = me?.organization?.name ?? "WebMee Vault";
  const roleLabel = !sessionReady
    ? "—"
    : me?.roles?.[0]
      ? formatRoleLabel(me.roles[0])
      : signedIn
        ? "Member"
        : "Not signed in";

  function navLink(item: SbItem) {
    const active = item.match(pathname);
    return (
      <Link key={item.label} href={item.href} className="vo-sb-link" onClick={closeNav}>
        <span className={`vo-sb-item ${active ? "active" : ""}`}>
          <item.Icon width={15} height={15} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
          <span className="vo-sb-item-label">{item.label}</span>
        </span>
      </Link>
    );
  }

  return (
    <div className={`vo-app${navOpen ? " vo-app--nav-open" : ""}`}>
      <CommandPalette />

      <button
        type="button"
        className="vo-nav-scrim"
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
        onClick={closeNav}
      />

      <aside id={navId} className="vo-sb" aria-label="Main navigation">
        <div className="vo-sb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/webmee-logo.png" alt="WebMee" className="vo-brand-logo" width={110} height={26} />
          <span className="vo-sb-brand-sep" aria-hidden />
          <span className="vo-sb-brand-product">VaultOps</span>
          <button
            type="button"
            className="vo-sb-close"
            onClick={closeNav}
            aria-label="Close menu"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="vo-sb-vault-meta">
          <div className="vo-sb-org-name">{orgName}</div>
          <div className="vo-sb-org-tier">Internal · AES-256-GCM</div>
        </div>

        <button
          type="button"
          className="vo-sb-search"
          onClick={() => {
            closeNav();
            window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
          }}
        >
          <SearchIcon width={13} height={13} />
          <span>Search vault</span>
          <kbd className="vo-kbd-desktop">⌘K</kbd>
        </button>

        <nav className="vo-sb-nav">
          <div className="vo-sb-section">Workspace</div>
          {WORKSPACE_NAV.map(navLink)}

          <div className="vo-sb-section">Security</div>
          {SECURITY_NAV.map(navLink)}
        </nav>

        <div className="vo-sb-foot">
          <Link href="/settings" className="vo-sb-link" onClick={closeNav}>
            <span className={`vo-sb-item ${pathname.startsWith("/settings") ? "active" : ""}`}>
              <SettingsIcon width={15} height={15} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
              <span className="vo-sb-item-label">Settings</span>
            </span>
          </Link>
          <div className="vo-sb-user">
            <div className="vo-sb-av">{initials(me)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vo-sb-user-name">{displayName(me)}</div>
              <div className="vo-sb-user-role">{roleLabel}</div>
            </div>
            <div className="vo-presence" />
          </div>
        </div>
      </aside>

      <main className="vo-main">
        <header className="vo-tb">
          <button
            type="button"
            className="vo-menu-btn"
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls={navId}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <CloseIcon width={18} height={18} /> : <MenuIcon width={18} height={18} />}
          </button>

          <div className="vo-tb-bc">
            <span className="vo-tb-bc-prev">{orgName}</span>
            <span className="vo-tb-bc-sep" aria-hidden>
              ›
            </span>
            <span className="vo-tb-bc-cur">{crumb}</span>
          </div>
          <div className="vo-tb-actions">
            <button
              type="button"
              className="vo-ico-btn"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              {theme === "dark" ? <SunIcon width={14} height={14} /> : <MoonIcon width={14} height={14} />}
            </button>
            <button
              type="button"
              className="vo-ico-btn vo-tb-search-btn"
              title="Search (⌘K)"
              aria-label="Open search"
              onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))}
            >
              <SearchIcon width={14} height={14} />
            </button>
            <Link href="/encryption" className="vo-ico-btn vo-tb-desk-only" title="Encryption status">
              <ShieldIcon width={14} height={14} />
            </Link>
            {sessionReady &&
              (signedIn ? (
                <LogoutButton
                  onCleared={() => {
                    setMe(null);
                    setHasToken(false);
                  }}
                />
              ) : (
                <Link href="/login" className="vo-btn vo-btn-webmee vo-btn-sm">
                  Sign in
                </Link>
              ))}
          </div>
        </header>

        <div className="vo-content">
          <div className="vo-content-body">{children}</div>
          <footer className="vo-app-footer">
            <p>
              © {new Date().getFullYear()}{" "}
              <a href="https://webmee.tech/" target="_blank" rel="noopener noreferrer">
                WebMee
              </a>
              . All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
