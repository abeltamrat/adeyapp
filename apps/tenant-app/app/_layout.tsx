import { Stack } from "expo-router";
import { OfflineQueueProvider } from "../providers/offline-queue-provider";
import { SessionProvider } from "../providers/session-provider";

export default function RootLayout() {
  return (
    <SessionProvider>
      <OfflineQueueProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineQueueProvider>
    </SessionProvider>
  );
}
