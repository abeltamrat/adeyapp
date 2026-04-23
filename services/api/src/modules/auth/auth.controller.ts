import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard.js";
import type { AuthenticatedRequestUser } from "../../common/auth/auth.types.js";
import { AuthService } from "./auth.service.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterOwnerDto } from "./dto/register-owner.dto.js";
import type { SelectTenantDto } from "./dto/select-tenant.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register-owner")
  registerOwner(@Body() payload: RegisterOwnerDto) {
    return this.authService.registerOwner(payload);
  }

  @Post("login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() currentUser: AuthenticatedRequestUser | undefined) {
    return this.authService.getSessionForUser(currentUser?.userId ?? "");
  }

  @UseGuards(JwtAuthGuard)
  @Post("select-tenant")
  selectTenant(
    @CurrentUser() currentUser: AuthenticatedRequestUser | undefined,
    @Body() payload: SelectTenantDto
  ) {
    return this.authService.selectTenant(currentUser?.userId ?? "", payload);
  }
}
