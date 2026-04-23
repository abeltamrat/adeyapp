import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module.js";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { TenantManagementModule } from "./modules/tenant-management/tenant-management.module.js";

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, TenantManagementModule],
  controllers: [AppController]
})
export class AppModule {}
