import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { UsersService } from "./users.service";

@Controller("org")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("members")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  listMembers(@CurrentUser() user: RequestUser) {
    return this.users.listOrgMembers(user);
  }

  @Get("me")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  me(@CurrentUser() user: RequestUser) {
    return this.users.getMe(user);
  }
}
