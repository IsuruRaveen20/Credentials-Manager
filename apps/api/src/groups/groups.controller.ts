import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { GroupsService } from "./groups.service";

@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  list(@CurrentUser() user: RequestUser) {
    return this.groups.list(user);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  get(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.groups.get(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GROUP_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.groups.create(user, body);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.GROUP_MANAGE)
  update(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.groups.update(id, user, body);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.GROUP_MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.groups.remove(id, user);
  }

  @Post(":id/members")
  @RequirePermissions(PERMISSIONS.GROUP_MANAGE)
  addMember(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.groups.addMember(id, user, body);
  }

  @Delete(":id/members/:memberId")
  @RequirePermissions(PERMISSIONS.GROUP_MANAGE)
  removeMember(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.groups.removeMember(id, memberId, user);
  }
}
