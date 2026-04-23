import { ApiError } from "@adeyapp/api-client";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import type { AppointmentSummary } from "@adeyapp/types";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function AppointmentsScreen() {
  const params = useLocalSearchParams<{ tenantSlug?: string; phone?: string; email?: string }>();
  const { session } = useSession();
  const tenantSlug = typeof params.tenantSlug === "string" ? params.tenantSlug : "";
  const activeTenantSlug =
    session?.tenants.find((tenant) => tenant.id === session?.context?.tenantId)?.slug ?? "";
  const canUseAccountMode = session?.context?.role === "customer" && (!tenantSlug || tenantSlug === activeTenantSlug);
  const [phone, setPhone] = useState(typeof params.phone === "string" ? params.phone : "");
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseAccountMode) {
      return;
    }

    let active = true;

    async function loadCustomerAppointments() {
      setLoading(true);
      setMessage(null);

      try {
        const nextAppointments = await customerApi.customer.listAppointments();
        if (!active) {
          return;
        }

        setAppointments(nextAppointments);
        if (!nextAppointments.length) {
          setMessage("No customer bookings are linked to this account yet.");
        }
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load your customer bookings right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCustomerAppointments();

    return () => {
      active = false;
    };
  }, [canUseAccountMode]);

  async function lookupBookings() {
    if (!tenantSlug || (!phone.trim() && !email.trim())) {
      setMessage("Choose a spa and enter the same phone or email you used while booking.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const nextAppointments = await customerApi.public.listBookings({
        tenantSlug,
        phone: phone || undefined,
        email: email || undefined
      });
      setAppointments(nextAppointments);
      if (!nextAppointments.length) {
        setMessage("No bookings matched that phone or email yet.");
      }
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to look up bookings right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Appointments</Text>
          <Text style={styles.title}>
            {canUseAccountMode ? "My bookings" : "Find your upcoming and past bookings"}
          </Text>
          <Text style={styles.copy}>
            {canUseAccountMode
              ? "Your signed-in account can load every booking linked to this workspace profile."
              : "Enter the phone number or email you used when you booked, then load your appointments."}
          </Text>
          {!canUseAccountMode ? (
            <>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor="#A68A78"
                style={styles.input}
                value={phone}
              />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor="#A68A78"
                style={styles.input}
                value={email}
              />
              <Pressable disabled={loading} onPress={() => void lookupBookings()} style={styles.primaryButton}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Load my bookings</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>

        {appointments.map((appointment) => (
          <View key={appointment.id} style={styles.bookingCard}>
            <Text style={styles.bookingTitle}>{appointment.branchName}</Text>
            <Text style={styles.bookingMeta}>Status: {appointment.status}</Text>
            <Text style={styles.bookingMeta}>Starts: {appointment.startAt}</Text>
            <Text style={styles.bookingMeta}>Ends: {appointment.endAt}</Text>
            {appointment.roomName ? <Text style={styles.bookingMeta}>Room: {appointment.roomName}</Text> : null}
            <View style={styles.lineList}>
              {appointment.lines.map((line) => (
                <Text key={line.id} style={styles.lineItem}>
                  {line.serviceName} ({line.serviceCode}) - {line.durationMinutes} min - {line.unitPrice}
                </Text>
              ))}
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
    gap: 14
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
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    gap: 6
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2B2421"
  },
  bookingMeta: {
    color: "#645853"
  },
  lineList: {
    marginTop: 8,
    gap: 4
  },
  lineItem: {
    color: "#4D4039"
  },
  message: {
    color: "#8B4B20"
  }
});
