"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { hasSessionToken, publicApiFetch, setAccessToken } from "@/lib/api";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const year = new Date().getFullYear();
  const nextRaw = searchParams.get("next") || "/dashboard";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  useEffect(() => {
    if (hasSessionToken()) {
      router.replace(nextPath);
    }
  }, [router, nextPath]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await publicApiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.accessToken);
      toast.success("Signed in");
      router.push(nextPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error("Sign-in failed", msg);
    } finally {
      setBusy(false);
    }
  }

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
            <h1 className="vo-auth-title">Sign in</h1>
            <p className="vo-auth-lead">
              Secure access to WebMee’s internal credential vault. Use your invite account to continue.
            </p>
            <ul className="vo-auth-points">
              <li>AES-256-GCM encrypted secrets</li>
              <li>Invite-only employee access</li>
              <li>Share logins safely across the team</li>
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
              <p className="vo-auth-panel-sub">Enter your work email and password to continue.</p>
            </div>

            <form className="vo-auth-form" onSubmit={onSubmit}>
              <label className="vo-auth-field">
                <span className="vo-auth-label">Email</span>
                <input
                  className="vo-auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@webmee.tech"
                  required
                />
              </label>

              <label className="vo-auth-field">
                <span className="vo-auth-label">Password</span>
                <div className="vo-auth-input-wrap">
                  <input
                    className="vo-auth-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    required
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

              {error && (
                <div className="vo-auth-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="vo-btn vo-btn-webmee vo-auth-submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="vo-auth-back">
              {hasClerkPublishableKey() ? (
                <>
                  <Link href="/sign-in">Sign in with Clerk →</Link>
                  <span aria-hidden> · </span>
                </>
              ) : null}
              <Link href="/">← Back to home</Link>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="vo-auth-gate">
          <div className="vo-auth-gate-card">
            <div className="vo-spinner" />
            <p>Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
