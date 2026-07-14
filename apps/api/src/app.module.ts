import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmployeesModule } from "./employees/employees.module";
import { HealthController } from "./health/health.controller";
import { MailModule } from "./mail/mail.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RbacModule } from "./rbac/rbac.module";
import { RedisModule } from "./redis/redis.module";
import { SecurityModule } from "./security/security.module";
import { SharesModule } from "./shares/shares.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: "default", ttl: 60_000, limit: 200 },
        { name: "reveal", ttl: 60_000, limit: 40 },
      ],
    }),
    MailModule,
    AuditModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CredentialsModule,
    CategoriesModule,
    SharesModule,
    EmployeesModule,
    DashboardModule,
    SecurityModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
