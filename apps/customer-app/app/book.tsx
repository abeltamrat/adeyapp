import { ApiError } from "@adeyapp/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import type { PublicCatalogBranchSummary, PublicCatalogServiceSummary } from "@adeyapp/types";
import { customerApi } from "../lib/api";
import { useSession } from "../providers/session-provider";

export default function BookScreen() {
  const params = useLocalSearchParams<{ tenantSlug?: string }>();
  const router = useRouter();
  const { session } = useSession();
  const tenantSlug = typeof params.tenantSlug === "string" ? params.tenantSlug : "";
  const activeTenantSlug =
    session?.tenants.find((tenant) => tenant.id === session?.context?.tenantId)?.slug ?? "";
  const useProfilePrefill = session?.context?.role === "customer" && tenantSlug === activeTenantSlug;
  const [branches, setBranches] = useState<PublicCatalogBranchSummary[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      if (!tenantSlug) {
        setLoading(false);
        setMessage("Choose a spa workspace from the home screen first.");
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const catalog = await customerApi.public.getCatalog({ tenantSlug });
        if (!active) {
          return;
        }

        setWorkspaceName(catalog.tenant.name);
        setBranches(catalog.branches);
        setSelectedBranchId(catalog.branches[0]?.id ?? "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load this booking catalog right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [tenantSlug]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!useProfilePrefill) {
        return;
      }

      try {
        const profile = await customerApi.customer.getProfile();
        if (!active) {
          return;
        }

        setFullName(profile.fullName);
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? "");
      } catch {
        // Keep public booking usable even if profile prefill fails.
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [useProfilePrefill]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? branches[0],
    [branches, selectedBranchId]
  );
  const selectedService = useMemo<PublicCatalogServiceSummary | undefined>(
    () => selectedBranch?.services.find((service) => service.id === selectedServiceId) ?? selectedBranch?.services[0],
    [selectedBranch, selectedServiceId]
  );

  useEffect(() => {
    if (!selectedBranch) {
      setSelectedServiceId("");
      setSelectedRoomId("");
      return;
    }

    const fallbackService =
      selectedBranch.services.find((service) => service.id === selectedServiceId) ??
      selectedBranch.services[0];
    setSelectedServiceId(fallbackService?.id ?? "");

    if (!fallbackService?.requiresRoom) {
      setSelectedRoomId("");
      return;
    }

    const roomExists = selectedBranch.rooms.some((room) => room.id === selectedRoomId);
    if (!roomExists) {
      setSelectedRoomId(selectedBranch.rooms[0]?.id ?? "");
    }
  }, [selectedBranch, selectedRoomId, selectedServiceId]);

  async function submitBooking() {
    if (!tenantSlug || !selectedBranch || !selectedService || !fullName.trim() || !bookingDate.trim() || !bookingTime.trim()) {
      setMessage("Choose a branch and service, then complete your name, date, and time.");
      return;
    }

    if (!phone.trim() && !email.trim()) {
      setMessage("Add a phone number or email so we can find your booking later.");
      return;
    }

    if (selectedService.requiresRoom && !selectedRoomId) {
      setMessage("This service needs a room selection before you can book.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const localDate = new Date(`${bookingDate}T${bookingTime}:00`);
      if (Number.isNaN(localDate.getTime())) {
        setMessage("Enter a valid booking date and time.");
        return;
      }

      await customerApi.public.createBooking({
        tenantSlug,
        branchId: selectedBranch.id,
        serviceId: selectedService.id,
        roomId: selectedService.requiresRoom ? selectedRoomId || undefined : undefined,
        fullName,
        phone: phone || undefined,
        email: email || undefined,
        startAt: localDate.toISOString(),
        notes: notes || undefined
      });

      setMessage("Booking created successfully. You can now review it in My bookings.");
      router.replace({
        pathname: "/appointments",
        params: canUseAccountMode ? undefined : { tenantSlug, phone, email }
      });
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create your booking right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canUseAccountMode = useProfilePrefill;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Booking</Text>
          <Text style={styles.title}>{workspaceName || "Book your appointment"}</Text>
          <Text style={styles.copy}>
            Pick a branch, choose a service, add your contact details, and save your booking.
          </Text>
        </View>

        {loading ? <ActivityIndicator color="#B56A17" /> : null}

        {!loading && selectedBranch ? (
          <>
            <Text style={styles.sectionTitle}>Choose a branch</Text>
            <View style={styles.chipRow}>
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => setSelectedBranchId(branch.id)}
                  style={[styles.chip, branch.id === selectedBranch.id ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, branch.id === selectedBranch.id ? styles.chipTextActive : null]}>
                    {branch.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Choose a service</Text>
            <View style={styles.listCard}>
              {selectedBranch.services.map((service) => (
                <Pressable
                  key={service.id}
                  onPress={() => setSelectedServiceId(service.id)}
                  style={[
                    styles.serviceCard,
                    service.id === selectedService?.id ? styles.serviceCardSelected : null
                  ]}
                >
                  <Text style={styles.serviceTitle}>
                    {service.name} ({service.code})
                  </Text>
                  <Text style={styles.serviceMeta}>
                    {service.durationMinutes} min | {service.price}
                  </Text>
                  {service.description ? <Text style={styles.serviceMeta}>{service.description}</Text> : null}
                </Pressable>
              ))}
            </View>

            {selectedService?.requiresRoom ? (
              <>
                <Text style={styles.sectionTitle}>Choose a room</Text>
                <View style={styles.chipRow}>
                  {selectedBranch.rooms.map((room) => (
                    <Pressable
                      key={room.id}
                      onPress={() => setSelectedRoomId(room.id)}
                      style={[styles.chip, room.id === selectedRoomId ? styles.chipActive : null]}
                    >
                      <Text style={[styles.chipText, room.id === selectedRoomId ? styles.chipTextActive : null]}>
                        {room.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Your details</Text>
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
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#A68A78"
              style={styles.input}
              value={email}
            />
            <TextInput
              onChangeText={setBookingDate}
              placeholder="Booking date (YYYY-MM-DD)"
              placeholderTextColor="#A68A78"
              style={styles.input}
              value={bookingDate}
            />
            <TextInput
              onChangeText={setBookingTime}
              placeholder="Booking time (HH:MM)"
              placeholderTextColor="#A68A78"
              style={styles.input}
              value={bookingTime}
            />
            <TextInput
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="#A68A78"
              style={styles.input}
              value={notes}
            />
            <Pressable disabled={submitting} onPress={() => void submitBooking()} style={styles.primaryButton}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Confirm booking</Text>}
            </Pressable>
          </>
        ) : null}

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B2421"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7D2BF",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  chipActive: {
    backgroundColor: "#B56A17",
    borderColor: "#B56A17"
  },
  chipText: {
    color: "#B56A17",
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#FFFFFF"
  },
  listCard: {
    gap: 10
  },
  serviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D2BF",
    padding: 16,
    gap: 6
  },
  serviceCardSelected: {
    borderColor: "#B56A17",
    backgroundColor: "#FFF1E0"
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B2421"
  },
  serviceMeta: {
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
  message: {
    color: "#8B4B20"
  }
});
