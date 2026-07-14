import Link from "next/link";

export default function NotFound() {
  return (
    <div className="vo-404">
      <div className="vo-404-glow" aria-hidden />
      <div className="vo-404-card">
        <div className="vo-404-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/webmee-logo.png" alt="WebMee" width={120} height={28} />
          <span className="vo-404-sep" aria-hidden />
          <span className="vo-404-product">VaultOps</span>
        </div>

        <p className="vo-404-code">404</p>
        <h1 className="vo-404-title">Page not found</h1>
        <p className="vo-404-lead">
          This path isn’t in the vault. It may have moved, been removed, or the link is wrong.
        </p>

        <div className="vo-404-actions">
          <Link href="/dashboard" className="vo-btn vo-btn-webmee">
            Go to dashboard
          </Link>
          <Link href="/login" className="vo-btn vo-btn-secondary">
            Sign in
          </Link>
        </div>

        <p className="vo-404-hint">
          Need something else? Open the{" "}
          <Link href="/vault">vault</Link>
          {" "}or go{" "}
          <Link href="/">home</Link>.
        </p>
      </div>
    </div>
  );
}
