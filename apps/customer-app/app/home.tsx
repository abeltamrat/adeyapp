import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
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
import type { PublicWorkspaceSummary } from "@adeyapp/types";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [workspaces, setWorkspaces] = useState<PublicWorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspaces() {
      setLoading(true);
      setMessage(null);

      try {
        const nextWorkspaces = await customerApi.public.listWorkspaces();
        if (!active) {
          return;
        }

        setWorkspaces(nextWorkspaces);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load spa workspaces right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Customer App</Text>
          <Text style={styles.title}>Choose your spa and book your next visit.</Text>
          <Text style={styles.copy}>
            Browse active workspaces, open their services, and look up your bookings by phone or email.
          </Text>
          {session?.context?.role === "customer" ? (
            <View style={styles.accountPanel}>
              <Text style={styles.workspaceMeta}>Signed in as {session.user.email}</Text>
              <View style={styles.buttonRow}>
                <Pressable onPress={() => router.push("/appointments")} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>My bookings</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/notifications")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Notifications</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/profile")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Profile</Text>
                </Pressable>
                <Pressable onPress={signOut} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Sign out</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/login")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign in or create account</Text>
            </Pressable>
          )}
        </View>

        {loading ? <ActivityIndicator color="#B56A17" /> : null}

        {!loading && !workspaces.length ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No public spa workspace is available yet.</Text>
          </View>
        ) : null}

        {workspaces.map((workspace) => (
          <View key={workspace.id} style={styles.card}>
            <Text style={styles.workspaceName}>{workspace.name}</Text>
            <Text style={styles.workspaceMeta}>/{workspace.slug}</Text>
            <Text style={styles.workspaceMeta}>
              {workspace.timezone} | {workspace.currency}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/book",
                    params: { tenantSlug: workspace.slug }
                  })
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Book now</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/appointments",
                    params: { tenantSlug: workspace.slug }
                  })
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Find bookings</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF7EE"
  },
  content: {
    padding: 24,
    gap: 16
  },
  hero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    gap: 12
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#B56A17",
    fontSize: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2B2421"
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: "#645853"
  },
  accountPanel: {
    gap: 10
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    gap: 10
  },
  workspaceName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2B2421"
  },
  workspaceMeta: {
    color: "#645853"
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  primaryButton: {
    backgroundColor: "#B56A17",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#FFF1E0",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: "#B56A17",
    fontWeight: "700"
  },
  emptyText: {
    color: "#645853"
  },
  message: {
    color: "#8B4B20"
  }
});
