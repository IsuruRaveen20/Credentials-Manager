import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async onModuleDestroy() {
    await this.client.quit();
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return n;
  }
}
