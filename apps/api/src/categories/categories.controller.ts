import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  list(@CurrentUser() user: RequestUser) {
    return this.categories.list(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.categories.create(user, body);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.categories.remove(user, id);
  }
}
