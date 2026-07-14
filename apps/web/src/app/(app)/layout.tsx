import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";

export default function AppWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="vo-app" style={{ padding: 24 }}>Loading workspace…</div>}>
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </Suspense>
  );
}
