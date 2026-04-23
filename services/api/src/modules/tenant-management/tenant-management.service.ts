import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import {
  BranchStatus,
  Prisma,
  RoleType,
  RoomStatus,
  ServiceStatus,
  SubscriptionStatus,
  TenantStatus
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import type { AuthenticatedRequestUser } from "../../common/auth/auth.types.js";
import type { CreateWorkspaceDto } from "./dto/create-workspace.dto.js";
import type { CreateRoomDto } from "./dto/create-room.dto.js";
import type { CreateServiceDto } from "./dto/create-service.dto.js";

const defaultRoleTypes: RoleType[] = [
  "owner",
  "manager",
  "receptionist",
  "employee",
  "customer"
];

@Injectable()
export class TenantManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(
    currentUser: AuthenticatedRequestUser | undefined,
    payload: CreateWorkspaceDto
  ) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException("Authentication is required");
    }

    const name = payload.name.trim();
    const slug = payload.slug.trim().toLowerCase();
    const timezone = payload.timezone.trim();
    const currency = payload.currency.trim().toUpperCase();
    const country = payload.country.trim();
    const branchName = payload.branch.name.trim();
    const branchCode = payload.branch.code.trim().toUpperCase();

    if (!name || !slug || !timezone || !currency || !country || !branchName || !branchCode) {
      throw new BadRequestException("Workspace and branch basics are required");
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug }
    });

    if (existingTenant) {
      throw new ConflictException("Workspace slug is already in use");
    }

    const existingBranchCode = await this.prisma.branch.findFirst({
      where: {
        tenant: { slug },
        code: branchCode
      }
    });

    if (existingBranchCode) {
      throw new ConflictException("Branch code is already in use for this workspace");
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          status: TenantStatus.trial,
          ownerUserId: currentUser.userId,
          timezone,
          currency,
          country,
          trialEndsAt: addDays(14),
          activatedAt: new Date()
        }
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: branchName,
          code: branchCode,
          status: BranchStatus.active,
          timezone: payload.branch.timezone?.trim() || timezone,
          city: payload.branch.city?.trim() || null,
          phone: payload.branch.phone?.trim() || null,
          email: payload.branch.email?.trim() || null,
          isDefault: true,
          approvedNetworks:
            payload.branch.approvedNetworkIdentifiers?.map((item) => item.trim()).filter(Boolean) ??
            Prisma.JsonNull
        }
      });

      await tx.role.createMany({
        data: defaultRoleTypes.map((roleType) => ({
          tenantId: tenant.id,
          name: toTitleCase(roleType),
          roleType,
          isSystemRole: true
        }))
      });

      await tx.workspacePolicy.createMany({
        data: [
          workspacePolicyRecord(tenant.id, "booking.cancellationWindowHours", { hours: 4 }),
          workspacePolicyRecord(tenant.id, "booking.leadTimeMinutes", { minutes: 120 }),
          workspacePolicyRecord(tenant.id, "attendance.approvedNetworkRequired", { enabled: true })
        ]
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planCode: "starter-trial",
          status: SubscriptionStatus.trial,
          startedAt: new Date(),
          renewsAt: addDays(14),
          graceEndsAt: addDays(17)
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          actorUserId: currentUser.userId,
          actionKey: "tenant.workspace_created",
          entityType: "Tenant",
          entityId: tenant.id,
          metadataJson: {
            tenantName: tenant.name,
            branchName: branch.name
          }
        }
      });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status
        },
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          timezone: branch.timezone
        }
      };
    });
  }

  async listOwnedWorkspaces(currentUser: AuthenticatedRequestUser | undefined) {
    if (!currentUser?.userId) {
      throw new UnauthorizedException("Authentication is required");
    }

    return this.prisma.tenant.findMany({
      where: {
        ownerUserId: currentUser.userId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        currency: true,
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            isDefault: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  }

  async listActiveTenantBranches(currentUser: AuthenticatedRequestUser | undefined) {
    const tenantId = this.requireOwnerTenant(currentUser);

    return this.prisma.branch.findMany({
      where: {
        tenantId
      },
      select: {
        id: true,
        name: true,
        code: true,
        timezone: true,
        isDefault: true,
        rooms: {
          select: {
            id: true,
            name: true,
            code: true,
            roomType: true,
            capacity: true,
            cleanupBufferMinutes: true
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        services: {
          select: {
            id: true,
            name: true,
            code: true,
            durationMinutes: true,
            price: true,
            requiresRoom: true,
            requiresEmployeeSkill: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  }

  async createRoom(
    currentUser: AuthenticatedRequestUser | undefined,
    payload: CreateRoomDto
  ) {
    const tenantId = this.requireOwnerTenant(currentUser);
    const branchId = payload.branchId.trim();
    const name = payload.name.trim();
    const code = payload.code.trim().toUpperCase();

    if (!branchId || !name || !code) {
      throw new BadRequestException("Branch, room name, and room code are required");
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId
      }
    });

    if (!branch) {
      throw new BadRequestException("Branch not found in the active workspace");
    }

    const existingRoom = await this.prisma.room.findFirst({
      where: {
        branchId,
        code
      }
    });

    if (existingRoom) {
      throw new ConflictException("Room code already exists in this branch");
    }

    const room = await this.prisma.room.create({
      data: {
        tenantId,
        branchId,
        name,
        code,
        roomType: payload.roomType?.trim() || null,
        capacity: payload.capacity && payload.capacity > 0 ? payload.capacity : 1,
        cleanupBufferMinutes:
          payload.cleanupBufferMinutes && payload.cleanupBufferMinutes >= 0
            ? payload.cleanupBufferMinutes
            : 0,
        status: RoomStatus.active
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        actorUserId: currentUser!.userId,
        actionKey: "tenant.room_created",
        entityType: "Room",
        entityId: room.id,
        metadataJson: {
          roomName: room.name,
          roomCode: room.code
        }
      }
    });

    return room;
  }

  async createService(
    currentUser: AuthenticatedRequestUser | undefined,
    payload: CreateServiceDto
  ) {
    const tenantId = this.requireOwnerTenant(currentUser);
    const branchId = payload.branchId.trim();
    const name = payload.name.trim();
    const code = payload.code.trim().toUpperCase();

    if (!branchId || !name || !code || !payload.durationMinutes || !payload.price) {
      throw new BadRequestException(
        "Branch, service name, service code, duration, and price are required"
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId
      }
    });

    if (!branch) {
      throw new BadRequestException("Branch not found in the active workspace");
    }

    const existingService = await this.prisma.service.findFirst({
      where: {
        tenantId,
        branchId,
        code
      }
    });

    if (existingService) {
      throw new ConflictException("Service code already exists in this branch");
    }

    const service = await this.prisma.service.create({
      data: {
        tenantId,
        branchId,
        name,
        code,
        description: payload.description?.trim() || null,
        durationMinutes: payload.durationMinutes,
        price: new Prisma.Decimal(payload.price),
        status: ServiceStatus.active,
        requiresRoom: payload.requiresRoom ?? true,
        requiresEmployeeSkill: payload.requiresEmployeeSkill ?? false
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        actorUserId: currentUser!.userId,
        actionKey: "tenant.service_created",
        entityType: "Service",
        entityId: service.id,
        metadataJson: {
          serviceName: service.name,
          serviceCode: service.code
        }
      }
    });

    return service;
  }

  private requireOwnerTenant(currentUser: AuthenticatedRequestUser | undefined): string {
    if (!currentUser?.userId || currentUser.role !== "owner" || !currentUser.tenantId) {
      throw new UnauthorizedException("Owner workspace context is required");
    }

    return currentUser.tenantId;
  }
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function toTitleCase(roleType: string): string {
  return roleType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function workspacePolicyRecord(
  tenantId: string,
  policyKey: string,
  policyValueJson: Prisma.InputJsonValue
) {
  return {
    tenantId,
    policyKey,
    policyValueJson,
    version: 1,
    isActive: true,
    effectiveFrom: new Date()
  };
}
