import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("stats")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  stats(@CurrentUser() user: RequestUser) {
    return this.dashboard.stats(user);
  }
}
