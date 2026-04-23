import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RoleType, UserStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import type { SessionResponse } from "../../common/auth/auth.types.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterOwnerDto } from "./dto/register-owner.dto.js";
import type { SelectTenantDto } from "./dto/select-tenant.dto.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async registerOwner(payload: RegisterOwnerDto): Promise<SessionResponse> {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password.trim();

    if (!email || !password) {
      throw new BadRequestException("Email and password are required");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        status: UserStatus.active
      }
    });

    return this.createSession(user.id, email);
  }

  async login(payload: LoginDto): Promise<SessionResponse> {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password.trim();

    if (!email || !password) {
      throw new BadRequestException("Email and password are required");
    }

    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.createSession(user.id, user.email, payload.tenantSlug);
  }

  async getSessionForUser(userId: string, tenantSlug?: string): Promise<SessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return this.createSession(user.id, user.email, tenantSlug);
  }

  async selectTenant(userId: string, payload: SelectTenantDto): Promise<SessionResponse> {
    if (!payload.tenantSlug?.trim()) {
      throw new BadRequestException("Tenant slug is required");
    }

    return this.getSessionForUser(userId, payload.tenantSlug.trim().toLowerCase());
  }

  private async createSession(
    userId: string,
    email: string,
    tenantSlug?: string
  ): Promise<SessionResponse> {
    const ownerTenants = await this.prisma.tenant.findMany({
      where: {
        ownerUserId: userId
      },
      include: {
        branches: {
          select: { id: true }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    let selectedTenant = ownerTenants[0];
    if (tenantSlug) {
      selectedTenant =
        ownerTenants.find((tenant) => tenant.slug === tenantSlug) ?? selectedTenant;
    }

    const role: RoleType | "platform_user" = selectedTenant ? "owner" : "platform_user";

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role,
        tenantId: selectedTenant?.id,
        branchId: selectedTenant?.branches[0]?.id
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? "adeyapp-dev-access-secret",
        expiresIn: process.env.JWT_ACCESS_TTL ?? "15m"
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role
      },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? "adeyapp-dev-refresh-secret",
        expiresIn: process.env.JWT_REFRESH_TTL ?? "30d"
      }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email
      },
      context: selectedTenant
        ? {
            tenantId: selectedTenant.id,
            branchId: selectedTenant.branches[0]?.id,
            role: "owner"
          }
        : undefined,
      tenants: ownerTenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: "owner",
        branchIds: tenant.branches.map((branch) => branch.id)
      }))
    };
  }
}
