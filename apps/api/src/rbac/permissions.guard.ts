import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/current-user.decorator";
import { SecurityService } from "../security/security.service";
import { RbacService } from "./rbac.service";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permissions.decorator";
import type { PermissionKey } from "./permissions";
import { PERMISSIONS } from "./permissions";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly security: SecurityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!keys?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user as RequestUser;
    const ip = req.ip;
    const userAgent = req.headers["user-agent"] as string | undefined;

    for (const key of keys) {
      const ok = await this.rbac.userHasPermission(user.internalUserId, user.organizationId, key);
      if (!ok) {
        await this.audit.log({
          actorId: user.internalUserId,
          action: "auth.denied",
          resourceType: "permission",
          resourceId: key,
          ip,
          userAgent,
          metadata: { required: keys },
        });
        if (key === PERMISSIONS.CREDENTIAL_REVEAL) {
          await this.security.recordRevealDenied(user.internalUserId, ip);
        }
        throw new ForbiddenException("Insufficient permissions");
      }
    }
    return true;
  }
}
