import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "./permissions";

export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...keys: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, keys);
