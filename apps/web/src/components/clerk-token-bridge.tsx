"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { registerClerkTokenGetter } from "@/lib/api";

/** Registers Clerk session `getToken` so apiFetch can send Clerk JWTs to the API. */
export function ClerkTokenBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    registerClerkTokenGetter(async () => {
      if (!isSignedIn) return null;
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    });
    return () => registerClerkTokenGetter(null);
  }, [getToken, isSignedIn]);

  return null;
}
