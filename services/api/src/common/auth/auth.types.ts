export type ApiRoleType =
  | "owner"
  | "manager"
  | "receptionist"
  | "employee"
  | "customer"
  | "superadmin"
  | "superadmin_support"
  | "superadmin_finance";

export interface ApiTenantContext {
  tenantId: string;
  branchId?: string;
  role: ApiRoleType;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: ApiRoleType | "platform_user";
  tenantId?: string;
  branchId?: string;
}

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  tenantId?: string;
  branchId?: string;
  role: ApiRoleType | "platform_user";
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  context?: ApiTenantContext;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    role: ApiRoleType;
    branchIds: string[];
  }>;
}
