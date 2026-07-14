import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(
    @CurrentUser() user: RequestUser,
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("prefix") prefix?: string,
    @Query("resourceId") resourceId?: string,
  ) {
    return this.audit.list(user, {
      limit: limit ? Number(limit) : 100,
      action: action || undefined,
      actionPrefix: prefix || undefined,
      resourceId: resourceId || undefined,
    });
  }
}
