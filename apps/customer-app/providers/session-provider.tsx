import type { AuthSession } from "@adeyapp/types";
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
import { setCustomerApiAccessToken } from "../lib/api";

interface SessionContextValue {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setCustomerApiAccessToken(session?.accessToken);
  }, [session]);

  const signOut = useCallback(() => {
    setSession(null);
    router.replace("/home");
  }, [router]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      setSession,
      signOut
    }),
    [session, signOut]
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
