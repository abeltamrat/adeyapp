import type { AuthSession, RoleType } from "@adeyapp/types";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { setTenantApiAccessToken } from "../lib/api";

interface SessionContextValue {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  signOut: () => void;
  resolveHomeRoute: (session: AuthSession | null) => Href;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setTenantApiAccessToken(session?.accessToken);
  }, [session]);

  const signOut = useCallback(() => {
    setSession(null);
    router.replace("/login");
  }, [router]);

  const resolveHomeRoute = useCallback((nextSession: AuthSession | null) => {
    if (!nextSession) {
      return "/login";
    }

    if (!nextSession.tenants.length) {
      return "/workspace/create";
    }

    if (nextSession.tenants.length > 1 && !nextSession.context?.tenantId) {
      return "/workspace/select";
    }

    return routeForRole(nextSession.context?.role ?? nextSession.tenants[0]?.role ?? "owner");
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      setSession,
      signOut,
      resolveHomeRoute
    }),
    [resolveHomeRoute, session, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return value;
}

function routeForRole(role: RoleType): Href {
  switch (role) {
    case "manager":
      return "/manager";
    case "receptionist":
      return "/reception";
    case "employee":
      return "/employee";
    case "owner":
    default:
      return "/owner";
  }
}
