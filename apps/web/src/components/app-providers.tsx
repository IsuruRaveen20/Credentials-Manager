"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { hasClerkPublishableKey } from "@/lib/clerk-config";
import { ClerkTokenBridge } from "@/components/clerk-token-bridge";

export function AppProviders({ children }: { children: ReactNode }) {
  const body = (
    <>
      {hasClerkPublishableKey() ? <ClerkTokenBridge /> : null}
      {children}
    </>
  );

  if (!hasClerkPublishableKey()) {
    return body;
  }

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      afterSignOutUrl="/login"
    >
      {body}
    </ClerkProvider>
  );
}
