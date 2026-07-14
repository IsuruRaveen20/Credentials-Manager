"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { publicApiFetch, setAccessToken } from "@/lib/api";

function AcceptInviteInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const toast = useToast();
  const [info, setInfo] = useState<{ email: string; firstName: string | null } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!token) {
      setError("This invite link is missing a token. Ask an admin to resend your invite.");
      setLoading(false);
      return;
    }
    setLoading(true);
    void publicApiFetch<{ email: string; firstName: string | null }>(
      `/auth/verify?token=${encodeURIComponent(token)}`,
    )
      .then((data) => {
        setInfo(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid or expired invite"))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const set = await publicApiFetch<{ email: string }>("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      const login = await publicApiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: set.email, password }),
      });
      setAccessToken(login.accessToken);
      toast.success("Account activated");
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to activate account";
      setError(msg);
      toast.error("Activation failed", msg);
    } finally {
      setBusy(false);
    }
  }

  const greeting = info?.firstName ? `Hi ${info.firstName}` : "Welcome";

  return (
    <div className="vo-auth">
      <div className="vo-auth-grid">
        <aside className="vo-auth-brand">
          <div className="vo-auth-brand-glow" aria-hidden />
          <div className="vo-auth-brand-inner">
            <div className="vo-auth-brand-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/webmee-logo.png" alt="WebMee" className="vo-auth-logo" width={140} height={32} />
              <span className="vo-auth-brand-sep" aria-hidden />
              <span className="vo-auth-product">VaultOps</span>
            </div>
            <h1 className="vo-auth-title">Activate access</h1>
            <p className="vo-auth-lead">
              You were invited to WebMee’s internal credential vault. Set a password to finish joining.
            </p>
            <ul className="vo-auth-points">
              <li>Invite-only — no public registration</li>
              <li>AES-256-GCM encrypted vault</li>
              <li>Use your work email only</li>
            </ul>
          </div>
          <footer className="vo-auth-foot vo-auth-foot--brand">
            <span>© {year} WebMee. All rights reserved.</span>
            <a href="https://webmee.tech/" target="_blank" rel="noopener noreferrer">
              webmee.tech
            </a>
          </footer>
        </aside>

        <main className="vo-auth-panel">
          <div className="vo-auth-panel-inner">
            <div className="vo-auth-panel-head">
              <h2 className="vo-auth-panel-title">Verify &amp; set password</h2>
              <p className="vo-auth-panel-sub">
                {loading
                  ? "Checking your invite…"
                  : info
                    ? `${greeting}. Confirm ${info.email} and choose a password (min. 10 characters).`
                    : "We couldn’t validate this invite link."}
              </p>
            </div>

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--fg-3)" }}>
                <div className="vo-spinner" />
                <span style={{ fontSize: 13 }}>Loading invite…</span>
              </div>
            )}

            {!loading && info && (
              <form className="vo-auth-form" onSubmit={(e) => void onSubmit(e)}>
                <label className="vo-auth-field">
                  <span className="vo-auth-label">Work email</span>
                  <input
                    className="vo-auth-input"
                    type="email"
                    value={info.email}
                    readOnly
                    autoComplete="username"
                  />
                </label>

                <label className="vo-auth-field">
                  <span className="vo-auth-label">New password</span>
                  <div className="vo-auth-input-wrap">
                    <input
                      className="vo-auth-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 10 characters"
                      minLength={10}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="vo-auth-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="vo-auth-field">
                  <span className="vo-auth-label">Confirm password</span>
                  <input
                    className="vo-auth-input"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    minLength={10}
                    required
                  />
                </label>

                {error && (
                  <div className="vo-auth-error" role="alert">
                    {error}
                  </div>
                )}

                <button type="submit" className="vo-btn vo-btn-webmee vo-auth-submit" disabled={busy}>
                  {busy ? "Activating…" : "Activate account"}
                </button>
              </form>
            )}

            {!loading && !info && error && (
              <div className="vo-auth-error" role="alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <p className="vo-auth-back">
              {info ? (
                <Link href="/login">Already activated? Sign in →</Link>
              ) : (
                <Link href="/login">← Back to sign in</Link>
              )}
            </p>
          </div>

          <footer className="vo-auth-foot vo-auth-foot--panel">
            <span>© {year} WebMee. All rights reserved.</span>
            <a href="https://webmee.tech/" target="_blank" rel="noopener noreferrer">
              webmee.tech
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="vo-auth">
          <div className="vo-auth-grid">
            <aside className="vo-auth-brand">
              <div className="vo-auth-brand-glow" aria-hidden />
              <div className="vo-auth-brand-inner">
                <div className="vo-auth-brand-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/webmee-logo.png" alt="WebMee" className="vo-auth-logo" width={140} height={32} />
                  <span className="vo-auth-brand-sep" aria-hidden />
                  <span className="vo-auth-product">VaultOps</span>
                </div>
                <h1 className="vo-auth-title">Activate access</h1>
              </div>
            </aside>
            <main className="vo-auth-panel">
              <div className="vo-auth-panel-inner">
                <p className="vo-auth-panel-sub">Loading invite…</p>
              </div>
            </main>
          </div>
        </div>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}
