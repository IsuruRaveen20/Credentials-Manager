"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { clearAccessToken } from "@/lib/api";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

function LogoutIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function PasswordLogoutButton({
  onCleared,
}: {
  onCleared: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  function logout() {
    clearAccessToken();
    onCleared();
    toast.info("Signed out");
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="vo-btn vo-btn-secondary vo-btn-sm vo-logout-btn" onClick={logout}>
      <LogoutIcon width={13} height={13} />
      <span className="vo-btn-label">Log out</span>
    </button>
  );
}

function ClerkLogoutButton({ onCleared }: { onCleared: () => void }) {
  const { signOut } = useClerk();
  const toast = useToast();

  async function logout() {
    clearAccessToken();
    onCleared();
    toast.info("Signed out");
    await signOut({ redirectUrl: "/login" });
  }

  return (
    <button
      type="button"
      className="vo-btn vo-btn-secondary vo-btn-sm vo-logout-btn"
      onClick={() => void logout()}
    >
      <LogoutIcon width={13} height={13} />
      <span className="vo-btn-label">Log out</span>
    </button>
  );
}

/** Clears password JWT and Clerk session when Clerk is configured. */
export function LogoutButton({ onCleared }: { onCleared: () => void }) {
  if (hasClerkPublishableKey()) {
    return <ClerkLogoutButton onCleared={onCleared} />;
  }
  return <PasswordLogoutButton onCleared={onCleared} />;
}
