import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export type SessionClaims = {
  sub: string;
  email: string;
  organizationId: string;
};

export type StepUpClaims = {
  sub: string;
  purpose: "step-up";
};

@Injectable()
export class PasswordJwtService {
  private readonly secret: Uint8Array;

  constructor(config: ConfigService) {
    const raw =
      config.get<string>("AUTH_JWT_SECRET") ??
      "dev-only-change-me-vaultops-auth-jwt-secret-32b";
    this.secret = new TextEncoder().encode(raw);
  }

  async signSession(claims: SessionClaims, ttl = "7d"): Promise<string> {
    return new SignJWT({
      email: claims.email,
      organizationId: claims.organizationId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime(ttl)
      .sign(this.secret);
  }

  async verifySession(token: string): Promise<SessionClaims> {
    const { payload } = await jwtVerify(token, this.secret);
    const sub = String(payload.sub ?? "");
    const email = typeof payload.email === "string" ? payload.email : "";
    const organizationId =
      typeof payload.organizationId === "string" ? payload.organizationId : "";
    if (!sub || !email || !organizationId) {
      throw new Error("Invalid session token claims");
    }
    return { sub, email, organizationId };
  }

  async signStepUp(userId: string, ttl = "5m"): Promise<string> {
    return new SignJWT({ purpose: "step-up" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(ttl)
      .sign(this.secret);
  }

  async verifyStepUp(token: string): Promise<StepUpClaims> {
    const { payload } = await jwtVerify(token, this.secret);
    const sub = String(payload.sub ?? "");
    if (!sub || payload.purpose !== "step-up") {
      throw new Error("Invalid step-up token");
    }
    return { sub, purpose: "step-up" };
  }
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}
