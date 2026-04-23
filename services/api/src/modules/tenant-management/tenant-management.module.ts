import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { TenantManagementController } from "./tenant-management.controller.js";
import { TenantManagementService } from "./tenant-management.service.js";

@Module({
  imports: [AuthModule],
  controllers: [TenantManagementController],
  providers: [TenantManagementService]
})
export class TenantManagementModule {}
