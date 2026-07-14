import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UsersModule } from "../users/users.module";
import { AuthGuard } from "./auth.guard";
import { ClerkJwtService } from "./clerk-jwt.service";
import { PasswordAuthController } from "./password-auth.controller";
import { PasswordAuthService } from "./password-auth.service";
import { PasswordJwtService } from "./password-jwt.service";

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [PasswordAuthController],
  providers: [
    ClerkJwtService,
    PasswordJwtService,
    PasswordAuthService,
    AuthGuard,
  ],
  exports: [
    ClerkJwtService,
    PasswordJwtService,
    PasswordAuthService,
    AuthGuard,
  ],
})
export class AuthModule {}
