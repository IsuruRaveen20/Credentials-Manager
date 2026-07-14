import Link from "next/link";

export default function HomePage() {
  const year = new Date().getFullYear();
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
            <h1 className="vo-auth-title">Encrypted access for the team.</h1>
            <p className="vo-auth-lead">
              Store and share credentials safely across WebMee. Invite-only — no public signups.
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
          <div className="vo-auth-panel-inner">
            <div className="vo-auth-panel-head">
              <h2 className="vo-auth-panel-title">Get started</h2>
              <p className="vo-auth-panel-sub">
                Sign in with your WebMee vault account to open the dashboard.
              </p>
            </div>
            <Link href="/login" className="vo-btn vo-btn-webmee vo-auth-submit" style={{ textDecoration: "none" }}>
              Sign in
            </Link>
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
