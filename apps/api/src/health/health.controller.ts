import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — use for Docker healthchecks (no DB). */
  @Public()
  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "up" };
  }
}
