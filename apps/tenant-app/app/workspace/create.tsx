import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { tenantApi } from "../../lib/api";
import { useSession } from "../../providers/session-provider";

export default function CreateWorkspaceScreen() {
  const router = useRouter();
  const { session, setSession } = useSession();
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [currency, setCurrency] = useState("KES");
  const [country, setCountry] = useState("Kenya");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [approvedNetworkIdentifiers, setApprovedNetworkIdentifiers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(
      session?.accessToken &&
        workspaceName.trim() &&
        workspaceSlug.trim() &&
        timezone.trim() &&
        currency.trim() &&
        country.trim() &&
        branchName.trim() &&
        branchCode.trim()
    );
  }, [branchCode, branchName, country, currency, session?.accessToken, timezone, workspaceName, workspaceSlug]);

  async function submit() {
    if (!canSubmit) {
      setMessage("Complete the workspace and branch fields first.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createWorkspace({
        name: workspaceName,
        slug: workspaceSlug,
        timezone,
        currency,
        country,
        branch: {
          name: branchName,
          code: branchCode,
          approvedNetworkIdentifiers: approvedNetworkIdentifiers
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        }
      });

      const refreshedSession = await tenantApi.auth.me();
      setSession(refreshedSession);
      setMessage("Workspace created. Redirecting to the owner shell.");
      router.replace("/owner");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the workspace right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Workspace Setup</Text>
          <Text style={styles.title}>Create your first spa workspace</Text>
          <Text style={styles.copy}>
            This wires directly to the new tenant-management API and creates the tenant,
            first branch, default roles, policies, and starter trial subscription.
          </Text>

          <TextInput
            onChangeText={setWorkspaceName}
            placeholder="Workspace name"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={workspaceName}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setWorkspaceSlug}
            placeholder="Workspace slug"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={workspaceSlug}
          />
          <TextInput
            onChangeText={setTimezone}
            placeholder="Timezone"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={timezone}
          />
          <TextInput
            autoCapitalize="characters"
            onChangeText={setCurrency}
            placeholder="Currency"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={currency}
          />
          <TextInput
            onChangeText={setCountry}
            placeholder="Country"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={country}
          />
          <TextInput
            onChangeText={setBranchName}
            placeholder="First branch name"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={branchName}
          />
          <TextInput
            autoCapitalize="characters"
            onChangeText={setBranchCode}
            placeholder="First branch code"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={branchCode}
          />
          <TextInput
            onChangeText={setApprovedNetworkIdentifiers}
            placeholder="Approved Wi-Fi IDs, comma-separated"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={approvedNetworkIdentifiers}
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable disabled={submitting} onPress={submit} style={styles.primaryButton}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create workspace</Text>
            )}
          </Pressable>
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
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    color: "#1E1E1E",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  }
});
