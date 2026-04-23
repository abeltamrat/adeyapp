import { ApiError } from "@adeyapp/api-client";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import type { CustomerAccountProfile } from "@adeyapp/types";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function CustomerProfileScreen() {
  const { session, signOut } = useSession();
  const [profile, setProfile] = useState<CustomerAccountProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.context?.tenantId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const nextProfile = await customerApi.customer.getProfile();
        if (!active) {
          return;
        }

        setProfile(nextProfile);
        setFullName(nextProfile.fullName);
        setPhone(nextProfile.phone ?? "");
        setDateOfBirth(nextProfile.dateOfBirth ? nextProfile.dateOfBirth.slice(0, 10) : "");
        setMarketingConsent(nextProfile.marketingConsent);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load your customer profile right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session?.context?.tenantId]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await customerApi.customer.updateProfile({
        fullName,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        marketingConsent
      });
      setProfile(updated);
      setMessage("Customer profile updated.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to save your customer profile right now.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Profile</Text>
          <Text style={styles.title}>Customer account</Text>
          {loading ? <ActivityIndicator color="#B56A17" /> : null}
          {profile ? (
            <>
              <Text style={styles.meta}>
                {profile.tenantName} / {profile.tenantSlug}
              </Text>
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
              <TextInput
                onChangeText={setDateOfBirth}
                placeholder="Date of birth (YYYY-MM-DD)"
                placeholderTextColor="#A68A78"
                style={styles.input}
                value={dateOfBirth}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Receive marketing updates</Text>
                <Switch onValueChange={setMarketingConsent} value={marketingConsent} />
              </View>
              <Pressable disabled={saving} onPress={() => void saveProfile()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save profile"}</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable onPress={signOut} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
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
  meta: { color: "#645853" },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E7D2BF",
    color: "#2B2421",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  switchLabel: { color: "#2B2421", fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#B56A17",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  secondaryButton: { alignItems: "center", paddingVertical: 10 },
  secondaryButtonText: { color: "#B56A17", fontWeight: "700" },
  message: { color: "#8B4B20" }
});
