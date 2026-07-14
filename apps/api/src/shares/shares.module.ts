import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { SharesController } from "./shares.controller";
import { SharesService } from "./shares.service";

@Module({
  imports: [RbacModule],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
