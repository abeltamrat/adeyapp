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
  TextInput,
  View
} from "react-native";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function CustomerLoginScreen() {
  const router = useRouter();
  const { setSession } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tenantSlug, setTenantSlug] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!tenantSlug.trim() || !email.trim() || !password.trim()) {
      setMessage("Workspace slug, email, and password are required.");
      return;
    }

    if (mode === "register" && !fullName.trim()) {
      setMessage("Full name is required for customer registration.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const session =
        mode === "register"
          ? await customerApi.auth.registerCustomer({
              tenantSlug,
              email,
              password,
              fullName,
              phone: phone || undefined
            })
          : await customerApi.auth.login({
              tenantSlug,
              email,
              password
            });

      setSession(session);
      router.replace("/home");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to continue with customer sign-in right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Customer Access</Text>
          <Text style={styles.title}>
            {mode === "register" ? "Create your booking account" : "Sign in to your booking account"}
          </Text>
          <Text style={styles.copy}>
            Use the spa workspace slug plus your email so we can load your profile, bookings, and notifications.
          </Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setTenantSlug}
            placeholder="Workspace slug"
            placeholderTextColor="#A68A78"
            style={styles.input}
            value={tenantSlug}
          />
          {mode === "register" ? (
            <>
              <TextInput
                onChangeText={setFullName}
                placeholder="Full name"
                placeholderTextColor="#A68A78"
                style={styles.input}
                value={fullName}
              />
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor="#A68A78"
                style={styles.input}
                value={phone}
              />
            </>
          ) : null}
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#A68A78"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#A68A78"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable disabled={loading} onPress={() => void submit()} style={styles.primaryButton}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "register" ? "Create account" : "Sign in"}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setMode((current) => (current === "login" ? "register" : "login"));
              setMessage(null);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {mode === "login" ? "New customer? Create account" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
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
    padding: 24
  },
  card: {
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
    fontSize: 24,
    fontWeight: "700",
    color: "#2B2421"
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: "#645853"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7D2BF",
    color: "#2B2421",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    backgroundColor: "#B56A17",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: "#B56A17",
    fontWeight: "700"
  },
  message: {
    color: "#8B4B20"
  }
});
