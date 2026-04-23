import type { AuthSession, RoleType } from "@adeyapp/types";

export type { AuthSession } from "@adeyapp/types";

export function canAccessRole(role: RoleType, allowed: RoleType[]): boolean {
  return allowed.includes(role);
}

export function hasTenantContext(session: AuthSession): boolean {
  return Boolean(session.context?.tenantId);
}
