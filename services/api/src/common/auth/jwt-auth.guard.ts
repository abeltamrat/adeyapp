import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthTokenPayload, AuthenticatedRequestUser } from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      authUser?: AuthenticatedRequestUser;
    }>();

    const authorization = request.headers?.authorization;
    if (!authorization || Array.isArray(authorization)) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const [scheme, token] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Invalid authorization header");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? "adeyapp-dev-access-secret"
      });

      request.authUser = {
        userId: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        role: payload.role
      };

      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
