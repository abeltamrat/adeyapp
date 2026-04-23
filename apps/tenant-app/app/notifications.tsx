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
import { tenantApi } from "../lib/api";

type NotificationSummary = Awaited<ReturnType<typeof tenantApi.notifications.list>>[number];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    setMessage(null);

    try {
      const nextNotifications = await tenantApi.notifications.list();
      setNotifications(nextNotifications);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to load notifications right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markRead(notificationId: string) {
    setBusyId(notificationId);
    setMessage(null);

    try {
      const updated = await tenantApi.notifications.markRead(notificationId);
      setNotifications((current) =>
        current.map((notification) => (notification.id === updated.id ? updated : notification))
      );
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the notification right now.");
      }
    } finally {
      setBusyId(null);
    }
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Notifications</Text>
          <Text style={styles.title}>Inbox</Text>
          <Text style={styles.copy}>
            Review booking changes, staff alerts, maintenance notices, and billing-related messages.
          </Text>
          <Pressable onPress={() => void loadNotifications()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Refresh inbox</Text>
          </Pressable>

          {loading ? <ActivityIndicator color="#1D5C63" /> : null}

          {!loading && !notifications.length ? (
            <Text style={styles.emptyText}>No notifications yet.</Text>
          ) : null}

          {notifications.map((notification) => (
            <View
              key={notification.id}
              style={[
                styles.notificationCard,
                notification.status === "unread" ? styles.notificationUnread : null
              ]}
            >
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMeta}>
                {notification.type} | {formatDateTime(notification.createdAt)}
              </Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              {notification.status === "unread" ? (
                <Pressable
                  disabled={busyId === notification.id}
                  onPress={() => void markRead(notification.id)}
                  style={styles.primaryButton}
                >
                  {busyId === notification.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Mark read</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.readState}>Read</Text>
              )}
            </View>
          ))}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F3EC"
  },
  content: {
    padding: 24
  },
  card: {
    backgroundColor: "#FFF9F1",
    borderRadius: 24,
    padding: 24,
    gap: 12
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#1D5C63",
    fontSize: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: "#596467"
  },
  emptyText: {
    color: "#7B8587"
  },
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 16,
    gap: 8
  },
  notificationUnread: {
    borderColor: "#1D5C63"
  },
  notificationTitle: {
    color: "#1E1E1E",
    fontWeight: "700",
    fontSize: 16
  },
  notificationMeta: {
    color: "#596467",
    fontSize: 12
  },
  notificationBody: {
    color: "#3B4344",
    lineHeight: 20
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#E6EFEF",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#1D5C63",
    fontWeight: "700"
  },
  readState: {
    color: "#596467",
    fontWeight: "600"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
