import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CryptoModule } from "../crypto/crypto.module";
import { KmsModule } from "../kms/kms.module";
import { RbacModule } from "../rbac/rbac.module";
import { SecurityModule } from "../security/security.module";
import { CredentialsController } from "./credentials.controller";
import { CredentialsService } from "./credentials.service";

@Module({
  imports: [AuthModule, CryptoModule, KmsModule, SecurityModule, RbacModule],
  controllers: [CredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
