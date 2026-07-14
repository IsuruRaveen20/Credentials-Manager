import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "vaultops_session";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/accept-invite(.*)",
  "/marketing(.*)",
]);

function clerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

const requireClerk =
  process.env.NEXT_PUBLIC_AUTH_REQUIRE_CLERK === "true" ||
  process.env.AUTH_MODE === "clerk";

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (next && next !== "/login") {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function hasPasswordSession(req: NextRequest): boolean {
  return req.cookies.get(SESSION_COOKIE)?.value === "1";
}

/**
 * Protect all non-public routes.
 * - Clerk-required mode: Clerk session only
 * - Hybrid / password: vaultops_session cookie (set on password login) and/or Clerk when configured
 */
export default clerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicRoute(req)) {
        return NextResponse.next();
      }
      if (requireClerk) {
        await auth.protect({
          unauthenticatedUrl: new URL("/login", req.url).toString(),
        });
        return NextResponse.next();
      }
      const { userId } = await auth();
      if (userId || hasPasswordSession(req)) {
        return NextResponse.next();
      }
      return redirectToLogin(req);
    })
  : function middleware(req: NextRequest) {
      if (isPublicRoute(req)) {
        return NextResponse.next();
      }
      if (hasPasswordSession(req)) {
        return NextResponse.next();
      }
      return redirectToLogin(req);
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
