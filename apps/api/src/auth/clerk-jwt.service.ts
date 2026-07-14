import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

@Injectable()
export class ClerkJwtService {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: ConfigService) {}

  private getJwks() {
    const jwksUrl = this.config.get<string>("CLERK_JWKS_URL");
    if (!jwksUrl) {
      throw new UnauthorizedException("CLERK_JWKS_URL is not configured");
    }
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }
    return this.jwks;
  }

  async verifyBearerToken(token: string): Promise<JWTPayload & { email?: string }> {
    const issuer = this.config.get<string>("CLERK_ISSUER");
    const audience = this.config.get<string>("CLERK_AUDIENCE");
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer: issuer || undefined,
        audience: audience || undefined,
      });
      return payload as JWTPayload & { email?: string };
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
