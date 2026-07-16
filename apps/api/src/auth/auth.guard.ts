import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { UsersService } from "../users/users.service";
import { ClerkJwtService } from "./clerk-jwt.service";
import { PasswordAuthService } from "./password-auth.service";
import { PasswordJwtService } from "./password-jwt.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

function emailFromClerkPayload(payload: Record<string, unknown>): string {
  if (typeof payload.email === "string" && payload.email.trim()) {
    return payload.email.trim();
  }
  if (typeof payload.primary_email === "string" && payload.primary_email.trim()) {
    return payload.primary_email.trim();
  }
  // Custom session token claim (Clerk Dashboard → Sessions → Customize session token)
  if (typeof payload.email_address === "string" && payload.email_address.trim()) {
    return payload.email_address.trim();
  }
  return "";
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkJwt: ClerkJwtService,
    private readonly passwordJwt: PasswordJwtService,
    private readonly passwordAuth: PasswordAuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = auth.slice("Bearer ".length).trim();
    const authMode = this.config.get<string>("AUTH_MODE", "hybrid");
    const jwksUrl = this.config.get<string>("CLERK_JWKS_URL")?.trim();

    // App-issued session JWT (first-party password login)
    if (authMode === "password" || authMode === "hybrid") {
      try {
        const claims = await this.passwordJwt.verifySession(token);
        const ctx = await this.passwordAuth.resolveSessionUser(claims);
        (req as Request & { user: unknown }).user = ctx;
        return true;
      } catch {
        // fall through
      }
    }

    // Dev bootstrap token — only when Clerk JWKS is unset AND explicitly opted in.
    // Defaults OFF so a password-only production deploy (no Clerk) never exposes
    // this as a standing admin backdoor. Docker dev opts in via ALLOW_DEV_TOKEN_AUTH=true.
    const allowDevToken = this.config.get<string>("ALLOW_DEV_TOKEN_AUTH", "false") === "true";
    if (!jwksUrl && allowDevToken && token === "dev-token") {
      const ctx = await this.usersService.resolveRequestContext({
        clerkId: "dev-user",
        email: "dev@localhost",
        firstName: "Dev",
        lastName: "User",
        skipDomainCheck: true,
      });
      (req as Request & { user: unknown }).user = ctx;
      return true;
    }

    if (jwksUrl && (authMode === "clerk" || authMode === "hybrid")) {
      const payload = await this.clerkJwt.verifyBearerToken(token);
      const clerkId = String(payload.sub);
      const email = emailFromClerkPayload(payload as Record<string, unknown>);
      if (!email) {
        throw new UnauthorizedException(
          "Clerk token missing email claim. Add `email` to the Clerk session token template.",
        );
      }
      const ctx = await this.usersService.resolveRequestContext({ clerkId, email });
      (req as Request & { user: unknown }).user = ctx;
      return true;
    }

    if (jwksUrl) {
      throw new UnauthorizedException(
        "Invalid token. Sign in with Clerk or password login (AUTH_MODE=hybrid).",
      );
    }

    throw new UnauthorizedException(
      "Invalid token. Login via POST /auth/login" +
        (authMode !== "clerk" && allowDevToken
          ? " or use Bearer dev-token when CLERK_JWKS_URL is unset."
          : "."),
    );
  }
}
