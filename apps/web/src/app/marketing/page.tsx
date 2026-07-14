import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-20">
      <header className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold tracking-tight">VaultOps</div>
        <Button variant="secondary" asChild>
          <Link href="/">Product</Link>
        </Button>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--fg-3)]">
            Internal credential platform
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Encrypted access for the entire engineering org.
          </h1>
          <p className="max-w-xl text-pretty text-[color:var(--fg-2)]">
            VaultOps is employee-only: SSO, MFA, passkeys via Clerk, envelope encryption with KMS, RBAC,
            and audit logs for every reveal.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-in">Request access</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vault">Open app</Link>
            </Button>
          </div>
        </div>

        <Card className="border-[color:var(--hairline-strong)] bg-[color:var(--bg-elev-1)] shadow-[var(--shadow-3)]">
          <CardHeader>
            <CardTitle className="text-base">What ships in v1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[color:var(--fg-2)]">
            <p>PostgreSQL metadata, Redis-backed rate limits, NestJS REST API, Next.js vault UI.</p>
            <p>AES-256-GCM payloads with per-credential data keys wrapped by AWS KMS or a local dev KMS.</p>
            <p>Append-only audit trail for create, read, reveal, update, delete, and permission denials.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
