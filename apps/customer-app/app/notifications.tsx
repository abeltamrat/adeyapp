import { ApiError } from "@adeyapp/api-client";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { NotificationSummary } from "@adeyapp/types";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function CustomerNotificationsScreen() {
  const { session } = useSession();
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNotifications() {
    if (!session?.context?.tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const rows = await customerApi.notifications.list();
      setNotifications(rows);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to load customer notifications right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [session?.context?.tenantId]);

  async function markRead(notificationId: string) {
    try {
      const updated = await customerApi.notifications.markRead(notificationId);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update this notification right now.");
      }
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Notifications</Text>
          <Text style={styles.title}>Booking updates</Text>
          {loading ? <ActivityIndicator color="#B56A17" /> : null}
          <View style={styles.list}>
            {notifications.length ? (
              notifications.map((item) => (
                <View key={item.id} style={styles.notificationCard}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationBody}>{item.body}</Text>
                  <Text style={styles.notificationMeta}>
                    {item.type} | {item.status} | {item.createdAt}
                  </Text>
                  {item.status !== "read" ? (
                    <Pressable onPress={() => void markRead(item.id)} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Mark read</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No customer notifications yet.</Text>
            )}
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF7EE" },
  content: { padding: 24 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, gap: 12 },
  eyebrow: { textTransform: "uppercase", letterSpacing: 2, color: "#B56A17", fontSize: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#2B2421" },
  list: { gap: 10 },
  notificationCard: {
    backgroundColor: "#FFF9F1",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D2BF",
    padding: 14,
    gap: 6
  },
  notificationTitle: { fontWeight: "700", color: "#2B2421" },
  notificationBody: { color: "#4D4039" },
  notificationMeta: { color: "#645853", fontSize: 12 },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF1E0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryButtonText: { color: "#B56A17", fontWeight: "700" },
  emptyText: { color: "#7B8587" },
  message: { color: "#8B4B20" }
});
