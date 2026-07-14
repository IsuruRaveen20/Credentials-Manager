import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "./current-user.decorator";
import type { RequestUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import { PasswordAuthService } from "./password-auth.service";

@Controller("auth")
export class PasswordAuthController {
  constructor(private readonly auth: PasswordAuthService) {}

  @Public()
  @Get("verify")
  verify(@Query("token") token?: string) {
    if (!token) {
      return { ok: false, error: "token required" };
    }
    return this.auth.verifyInviteToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("set-password")
  setPassword(@Body() body: unknown) {
    return this.auth.setPassword(body);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("login")
  login(@Body() body: unknown, @Req() req: Request) {
    return this.auth.login(body, req.ip);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("step-up")
  stepUp(@CurrentUser() user: RequestUser, @Body() body: unknown, @Req() req: Request) {
    return this.auth.stepUp(user, body, req.ip);
  }
}
