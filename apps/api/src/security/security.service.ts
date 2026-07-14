import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";

interface RateEntry {
  count: number;
  expiresAt: number;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly store = new Map<string, RateEntry>();

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private getEntry(key: string): RateEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private incrWithTtl(key: string, ttlSeconds: number): number {
    const entry = this.getEntry(key);
    if (!entry) {
      this.store.set(key, { count: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async recordRevealDenied(userId: string, ip?: string | null) {
    const windowSec = 300;
    const key = `reveal_denied:${userId}`;
    const n = this.incrWithTtl(key, windowSec);
    const threshold = Number(this.config.get("SUSPICIOUS_REVEAL_THRESHOLD", "8"));
    if (n >= threshold) {
      this.logger.warn(`Suspicious reveal denials for user ${userId}: ${n} in ${windowSec}s`);
      await this.audit.log({
        actorId: userId,
        action: "security.suspicious",
        resourceType: "reveal_denied",
        resourceId: String(n),
        ip: ip ?? undefined,
        metadata: { count: n, windowSec },
      });
    }
  }

  async recordRevealSuccess(userId: string) {
    this.store.delete(`reveal_denied:${userId}`);
  }
}
