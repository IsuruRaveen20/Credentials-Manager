import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

export default function SignInPage() {
  const year = new Date().getFullYear();

  if (!hasClerkPublishableKey()) {
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
              <h1 className="vo-auth-title">Clerk sign-in</h1>
              <p className="vo-auth-lead">
                Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and API{" "}
                <code>CLERK_JWKS_URL</code> to enable Clerk.
              </p>
            </div>
          </aside>
          <main className="vo-auth-panel">
            <div className="vo-auth-panel-inner">
              <p className="vo-auth-panel-sub">Clerk is not configured in this environment.</p>
              <p className="vo-auth-back">
                <Link href="/login">← Password sign in</Link>
              </p>
            </div>
          </main>
        </div>
      </div>
    );
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
            <h1 className="vo-auth-title">Sign in with Clerk</h1>
            <p className="vo-auth-lead">
              Invite-only access. Your Clerk email must already have a VaultOps membership.
            </p>
          </div>
          <footer className="vo-auth-foot vo-auth-foot--brand">
            <span>© {year} WebMee. All rights reserved.</span>
            <a href="https://webmee.tech/" target="_blank" rel="noopener noreferrer">
              webmee.tech
            </a>
          </footer>
        </aside>

        <main className="vo-auth-panel">
          <div className="vo-auth-panel-inner" style={{ display: "flex", justifyContent: "center" }}>
            <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />
          </div>
          <p className="vo-auth-back" style={{ padding: "0 1.5rem 1rem" }}>
            <Link href="/login">← Password sign in</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
