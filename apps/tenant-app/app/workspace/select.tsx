import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { tenantApi } from "../../lib/api";
import { useSession } from "../../providers/session-provider";

export default function SelectWorkspaceScreen() {
  const router = useRouter();
  const { session, setSession, resolveHomeRoute } = useSession();
  const [submittingSlug, setSubmittingSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function selectWorkspace(tenantSlug: string) {
    setSubmittingSlug(tenantSlug);
    setMessage(null);

    try {
      const nextSession = await tenantApi.auth.selectTenant({ tenantSlug });
      setSession(nextSession);
      router.replace(resolveHomeRoute(nextSession));
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to switch workspace right now.");
      }
    } finally {
      setSubmittingSlug(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Workspace Select</Text>
          <Text style={styles.title}>Choose the workspace to open</Text>
          <Text style={styles.copy}>
            This is ready for owners who manage more than one tenant workspace.
          </Text>
          {session?.tenants.map((tenant) => {
            const active = tenant.id === session.context?.tenantId;
            const busy = submittingSlug === tenant.slug;

            return (
              <Pressable
                key={tenant.id}
                disabled={busy}
                onPress={() => selectWorkspace(tenant.slug)}
                style={[styles.workspaceButton, active ? styles.workspaceButtonActive : null]}
              >
                <View style={styles.workspaceMeta}>
                  <Text style={styles.workspaceName}>{tenant.name}</Text>
                  <Text style={styles.workspaceSlug}>/{tenant.slug}</Text>
                </View>
                {busy ? <ActivityIndicator color="#1D5C63" /> : null}
              </Pressable>
            );
          })}
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
  workspaceButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  workspaceButtonActive: {
    borderColor: "#1D5C63"
  },
  workspaceMeta: {
    gap: 4
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  workspaceSlug: {
    color: "#596467"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
