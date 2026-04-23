import { AppState, type AppStateStatus } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { flushOfflineQueue, getOfflineQueueSnapshot, type OfflineQueueScope } from "../lib/offline-queue";
import { useSession } from "./session-provider";

interface OfflineQueueContextValue {
  queueLabels: string[];
  queueCount: number;
  syncing: boolean;
  refreshQueue: () => Promise<void>;
  syncQueue: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [queueLabels, setQueueLabels] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const lastSyncAt = useRef<number>(0);

  const scope = useMemo<OfflineQueueScope | null>(() => {
    const tenantId = session?.context?.tenantId;
    const userId = session?.user.id;
    if (!tenantId || !userId) {
      return null;
    }

    return { tenantId, userId };
  }, [session?.context?.tenantId, session?.user.id]);

  const refreshQueue = useCallback(async () => {
    if (!scope) {
      setQueueLabels([]);
      return;
    }

    const snapshot = await getOfflineQueueSnapshot(scope);
    setQueueLabels(snapshot.map((item) => item.label));
  }, [scope]);

  const syncQueue = useCallback(async () => {
    if (!scope || syncing) {
      return;
    }

    setSyncing(true);

    try {
      await flushOfflineQueue(scope);
      await refreshQueue();
      lastSyncAt.current = Date.now();
    } finally {
      setSyncing(false);
    }
  }, [refreshQueue, scope, syncing]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (!scope) {
      return;
    }

    void syncQueue();
  }, [scope, syncQueue]);

  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== "active" || !scope) {
        return;
      }

      if (Date.now() - lastSyncAt.current < 10000) {
        return;
      }

      void syncQueue();
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [scope, syncQueue]);

  const value = useMemo<OfflineQueueContextValue>(
    () => ({
      queueLabels,
      queueCount: queueLabels.length,
      syncing,
      refreshQueue,
      syncQueue
    }),
    [queueLabels, refreshQueue, syncing, syncQueue]
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue() {
  const value = useContext(OfflineQueueContext);
  if (!value) {
    throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  }

  return value;
}
