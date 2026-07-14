import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/current-user.decorator";
import { PasswordJwtService } from "../auth/password-jwt.service";
import { PERMISSIONS } from "../rbac/permissions";
import { RequirePermissions } from "../rbac/require-permissions.decorator";
import { CredentialsService } from "./credentials.service";

@Controller("credentials")
export class CredentialsController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly jwt: PasswordJwtService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  list(@CurrentUser() user: RequestUser) {
    return this.credentials.list(user);
  }

  @Get("categories")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  categories(@CurrentUser() user: RequestUser) {
    return this.credentials.listCategories(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.credentials.create(user, body);
  }

  @Get(":id/reveal")
  @Throttle({ reveal: { limit: 40, ttl: 60_000 } })
  @RequirePermissions(PERMISSIONS.CREDENTIAL_REVEAL)
  async reveal(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Headers("x-vaultops-step-up") stepUp?: string,
  ) {
    let stepUpOk = false;
    if (stepUp) {
      try {
        const claims = await this.jwt.verifyStepUp(stepUp);
        stepUpOk = claims.sub === user.internalUserId;
      } catch {
        stepUpOk = false;
      }
    }
    return this.credentials.reveal(id, user, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      stepUpOk,
    });
  }

  @Get(":id/edit")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  getForEdit(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.credentials.getForEdit(id, user);
  }

  @Post(":id/rotate")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  rotate(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.credentials.rotate(id, user, body);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_READ)
  get(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.credentials.getMeta(id, user);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_WRITE)
  update(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.credentials.update(id, user, body);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CREDENTIAL_DELETE)
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.credentials.remove(id, user);
  }
}
