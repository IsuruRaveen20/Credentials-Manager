import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { SharesService } from "./shares.service";

@Controller("credentials/:id/shares")
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  list(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.shares.listShares(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_SHARE)
  share(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.shares.share(id, user, body);
  }

  @Delete(":userId")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_SHARE)
  unshare(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shares.unshare(id, userId, user);
  }
}
