"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { hasSessionToken } from "@/lib/api";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="vo-auth-gate" aria-busy="true" aria-live="polite">
      <div className="vo-auth-gate-card">
        <div className="vo-spinner" />
        <p>{children}</p>
      </div>
    </div>
  );
}

function PasswordAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!hasSessionToken()) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
      return;
    }
    setAllowed(true);
  }, [router, pathname]);

  if (!allowed) {
    return <GateShell>Checking session…</GateShell>;
  }
  return <>{children}</>;
}

function ClerkAwareAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn || hasSessionToken()) {
      setAllowed(true);
      return;
    }
    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [isLoaded, isSignedIn, router, pathname]);

  if (!isLoaded || !allowed) {
    return <GateShell>Checking session…</GateShell>;
  }
  return <>{children}</>;
}

/** Blocks internal app routes until a real password JWT and/or Clerk session exists. */
export function AuthGate({ children }: { children: ReactNode }) {
  if (hasClerkPublishableKey()) {
    return <ClerkAwareAuthGate>{children}</ClerkAwareAuthGate>;
  }
  return <PasswordAuthGate>{children}</PasswordAuthGate>;
}
