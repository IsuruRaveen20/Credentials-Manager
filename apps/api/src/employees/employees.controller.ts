import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  list(@CurrentUser() user: RequestUser) {
    return this.employees.list(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_INVITE)
  invite(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.employees.invite(user, body);
  }

  @Post(":id/resend-invite")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_INVITE)
  resend(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employees.resendInvite(user, id);
  }

  @Post(":id/disable")
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  disable(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employees.disable(user, id);
  }

  @Patch(":id/role")
  @RequirePermissions(PERMISSIONS.ROLE_ASSIGN)
  setRole(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.employees.setRole(user, id, body);
  }
}
