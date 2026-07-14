import { hasClerkPublishableKey } from "@/lib/clerk-config";

const TOKEN_KEY = "vaultops_access_token";
const STEP_UP_KEY = "vaultops_step_up_token";
/** Cookie mirrored on login so middleware can block anonymous app routes. */
export const SESSION_COOKIE = "vaultops_session";

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:13001";

/** Opt-in legacy bearer for API when AuthGuard still accepts it (no Clerk JWKS). */
function allowDevTokenFallback(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_TOKEN === "true") return true;
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_TOKEN === "false") return false;
  // Default: only when Clerk is not configured on the web
  return !hasClerkPublishableKey();
}

type ClerkTokenGetter = () => Promise<string | null>;
let clerkTokenGetter: ClerkTokenGetter | null = null;

export function registerClerkTokenGetter(fn: ClerkTokenGetter | null) {
  clerkTokenGetter = fn;
}

function writeSessionCookie(present: boolean) {
  if (typeof document === "undefined") return;
  if (present) {
    // 7 days — JWT lifetime is shorter; middleware only needs an auth marker.
    document.cookie = `${SESSION_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

export function getAccessToken(): string {
  if (typeof window === "undefined") {
    // Server components must not impersonate a logged-in user.
    return "";
  }
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored && stored !== "dev-token") {
    writeSessionCookie(true);
    return stored;
  }
  // Explicit stored dev-token only when opted in — never invent one after logout.
  if (stored === "dev-token" && allowDevTokenFallback()) return "dev-token";
  return "";
}

/** True when a real password-login JWT is present (not inventing a silent dev-token). */
export function hasSessionToken(): boolean {
  if (typeof window === "undefined") return false;
  const t = localStorage.getItem(TOKEN_KEY);
  const ok = Boolean(t && t !== "dev-token");
  if (ok) writeSessionCookie(true);
  return ok;
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    writeSessionCookie(token !== "dev-token");
  } else {
    localStorage.removeItem(TOKEN_KEY);
    writeSessionCookie(false);
  }
}

export function clearAccessToken() {
  setAccessToken(null);
  clearStepUpToken();
  writeSessionCookie(false);
}

export function getStepUpToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STEP_UP_KEY);
}

export function setStepUpToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(STEP_UP_KEY, token);
  else sessionStorage.removeItem(STEP_UP_KEY);
}

export function clearStepUpToken() {
  setStepUpToken(null);
}

async function resolveBearerToken(): Promise<string> {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && stored !== "dev-token") return stored;
    if (stored === "dev-token" && allowDevTokenFallback()) return "dev-token";
  }
  if (clerkTokenGetter) {
    const clerkToken = await clerkTokenGetter();
    if (clerkToken) return clerkToken;
  }
  return getAccessToken();
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = await resolveBearerToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const stepUp = getStepUpToken();
  if (stepUp) {
    headers.set("X-VaultOps-Step-Up", stepUp);
  }
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearAccessToken();
    }
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(json.message)) message = json.message.join(", ");
      else if (typeof json.message === "string") message = json.message;
    } catch {
      /* keep raw text */
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function publicApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(json.message)) message = json.message.join(", ");
      else if (typeof json.message === "string") message = json.message;
    } catch {
      /* keep */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
