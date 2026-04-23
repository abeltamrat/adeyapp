import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { tenantApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { setSession, resolveHomeRoute } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const session =
        mode === "login"
          ? await tenantApi.auth.login({
              email,
              password
            })
          : await tenantApi.auth.registerOwner({
              email,
              password,
              fullName
            });

      setSession(session);
      router.replace(resolveHomeRoute(session));
    } catch (issue) {
      if (issue instanceof ApiError) {
        setError(issue.details.message);
      } else {
        setError("Unable to connect to the API right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Tenant App</Text>
        <Text style={styles.title}>{mode === "login" ? "Sign in" : "Create owner account"}</Text>
        <Text style={styles.copy}>
          Start with owner sign-up or log into an existing workspace account.
        </Text>
        {mode === "register" ? (
          <TextInput
            autoCapitalize="words"
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor="#8A918F"
            style={styles.input}
            value={fullName}
          />
        ) : null}
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#8A918F"
          style={styles.input}
          value={email}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#8A918F"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={submitting} onPress={submit} style={styles.primaryButton}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>
        <Pressable
          disabled={submitting}
          onPress={() => {
            setMode((current) => (current === "login" ? "register" : "login"));
            setError(null);
          }}
        >
          <Text style={styles.link}>
            {mode === "login"
              ? "Need an owner account? Register here"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F3EC",
    justifyContent: "center",
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
  },
  error: {
    color: "#A33A2A",
    fontSize: 14
  },
  link: {
    marginTop: 8,
    color: "#1D5C63",
    fontWeight: "700"
  }
});
