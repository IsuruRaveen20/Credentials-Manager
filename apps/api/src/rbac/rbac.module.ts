import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { SecurityModule } from "../security/security.module";
import { PermissionsGuard } from "./permissions.guard";
import { RbacService } from "./rbac.service";

@Module({
  imports: [SecurityModule],
  providers: [
    RbacService,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [RbacService],
})
export class RbacModule {}
