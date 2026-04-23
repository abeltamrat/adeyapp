import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard.js";
import type { AuthenticatedRequestUser } from "../../common/auth/auth.types.js";
import type { CreateWorkspaceDto } from "./dto/create-workspace.dto.js";
import type { CreateRoomDto } from "./dto/create-room.dto.js";
import type { CreateServiceDto } from "./dto/create-service.dto.js";
import { TenantManagementService } from "./tenant-management.service.js";

@Controller("tenant-management")
@UseGuards(JwtAuthGuard)
export class TenantManagementController {
  constructor(private readonly tenantManagementService: TenantManagementService) {}

  @Post("workspaces")
  createWorkspace(
    @CurrentUser() currentUser: AuthenticatedRequestUser | undefined,
    @Body() payload: CreateWorkspaceDto
  ) {
    return this.tenantManagementService.createWorkspace(currentUser, payload);
  }

  @Get("workspaces")
  listOwnedWorkspaces(@CurrentUser() currentUser: AuthenticatedRequestUser | undefined) {
    return this.tenantManagementService.listOwnedWorkspaces(currentUser);
  }

  @Get("branches")
  listActiveTenantBranches(@CurrentUser() currentUser: AuthenticatedRequestUser | undefined) {
    return this.tenantManagementService.listActiveTenantBranches(currentUser);
  }

  @Post("rooms")
  createRoom(
    @CurrentUser() currentUser: AuthenticatedRequestUser | undefined,
    @Body() payload: CreateRoomDto
  ) {
    return this.tenantManagementService.createRoom(currentUser, payload);
  }

  @Post("services")
  createService(
    @CurrentUser() currentUser: AuthenticatedRequestUser | undefined,
    @Body() payload: CreateServiceDto
  ) {
    return this.tenantManagementService.createService(currentUser, payload);
  }
}
