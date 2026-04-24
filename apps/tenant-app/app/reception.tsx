import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
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
import { tenantApi } from "../lib/api";
import {
  createOfflineCustomerId,
  enqueueOfflineAction,
  isOfflineCustomerId,
  shouldQueueOffline
} from "../lib/offline-queue";
import { useOfflineQueue } from "../providers/offline-queue-provider";
import { useSession } from "../providers/session-provider";
import type { AppointmentStatus } from "@adeyapp/types";

type BranchSetupSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listBranches>>[number];
type CustomerSummary = Awaited<ReturnType<typeof tenantApi.reception.listCustomers>>[number];
type AppointmentSummary = Awaited<ReturnType<typeof tenantApi.reception.listAppointments>>[number];
type EmployeeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listEmployees>>[number];
type PolicyRole = "manager" | "receptionist" | "employee";

function isPolicyRole(value?: string): value is PolicyRole {
  return value === "manager" || value === "receptionist" || value === "employee";
}

function defaultStartAtValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

export default function ReceptionScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { queueCount, syncing, refreshQueue, syncQueue } = useOfflineQueue();
  const isReceptionist = session?.context?.role === "receptionist";
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [acknowledgement, setAcknowledgement] = useState<
    Awaited<ReturnType<typeof tenantApi.policies.getCurrentAcknowledgement>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [bookingCustomerId, setBookingCustomerId] = useState("");
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingRoomId, setBookingRoomId] = useState("");
  const [bookingEmployeeId, setBookingEmployeeId] = useState("");
  const [bookingStartAt, setBookingStartAt] = useState(defaultStartAtValue);
  const [bookingNotes, setBookingNotes] = useState("");

  const selectedBranch = useMemo(
    () =>
      branches.find((branch) => branch.id === selectedBranchId) ??
      branches.find((branch) => branch.id === session?.context?.branchId) ??
      branches[0],
    [branches, selectedBranchId, session?.context?.branchId]
  );

  const selectedService = selectedBranch?.services.find((service) => service.id === bookingServiceId) ?? null;
  const currentRole = session?.context?.role;
  const acknowledgementRequired = Boolean(
    acknowledgement?.enabled &&
      isPolicyRole(currentRole) &&
      acknowledgement.requiredRoles.includes(currentRole) &&
      !acknowledgement.acknowledged
  );

  useEffect(() => {
    let active = true;

    async function loadFrontDesk() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) return;

        const branchId = selectedBranchId || session?.context?.branchId || nextBranches[0]?.id || "";
        setBranches(nextBranches);
        setSelectedBranchId(branchId);

        if (!branchId) {
          setCustomers([]);
          setAppointments([]);
          return;
        }

        const [nextCustomers, nextEmployees, nextAppointments, nextAcknowledgement] = await Promise.all([
          tenantApi.reception.listCustomers({ branchId }),
          tenantApi.tenantManagement.listEmployees({ branchId }),
          tenantApi.reception.listAppointments({
            branchId,
            date: new Date().toISOString().slice(0, 10)
          }),
          tenantApi.policies.getCurrentAcknowledgement()
        ]);

        if (!active) return;

        setCustomers(nextCustomers);
        setEmployees(nextEmployees);
        setAppointments(nextAppointments);
        setAcknowledgement(nextAcknowledgement);
        setBookingCustomerId(nextCustomers[0]?.id || "");
      } catch (issue) {
        if (!active) return;
        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load reception data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFrontDesk();
    return () => { active = false; };
  }, [selectedBranchId, session?.context?.branchId]);

  async function refreshFrontDesk(branchId: string) {
    const [nextBranches, nextCustomers, nextEmployees, nextAppointments, nextAcknowledgement] = await Promise.all([
      tenantApi.tenantManagement.listBranches(),
      tenantApi.reception.listCustomers({ branchId }),
      tenantApi.tenantManagement.listEmployees({ branchId }),
      tenantApi.reception.listAppointments({
        branchId,
        date: new Date().toISOString().slice(0, 10)
      }),
      tenantApi.policies.getCurrentAcknowledgement()
    ]);

    setBranches(nextBranches);
    setCustomers(nextCustomers);
    setEmployees(nextEmployees);
    setAppointments(nextAppointments);
    setAcknowledgement(nextAcknowledgement);
    await refreshQueue();
  }

  async function submitCustomer() {
    if (acknowledgementRequired || !selectedBranch || !customerName.trim()) return;

    setCreatingCustomer(true);
    setMessage(null);

    try {
      const customer = await tenantApi.reception.createCustomer({
        branchId: selectedBranch.id,
        fullName: customerName,
        phone: customerPhone || undefined,
        email: customerEmail || undefined
      });

      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setBookingCustomerId(customer.id);
      setMessage("Customer created.");
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        const offlineId = createOfflineCustomerId();
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createCustomer",
          payload: { branchId: selectedBranch.id, fullName: customerName, phone: customerPhone || undefined, email: customerEmail || undefined }
        });
        setCustomers([{ id: offlineId, fullName: customerName, phone: customerPhone || null, email: customerEmail || null, primaryBranchId: selectedBranch.id, marketingConsent: false, notes: null, createdAt: new Date().toISOString() }, ...customers]);
        await refreshQueue();
        setCustomerName(""); setCustomerPhone(""); setCustomerEmail("");
        setBookingCustomerId(offlineId);
        setMessage("Saved offline.");
        return;
      }
      setMessage(issue instanceof ApiError ? issue.details.message : "Error creating customer.");
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function submitAppointment() {
    if (acknowledgementRequired || !selectedBranch || !bookingCustomerId || !bookingServiceId) return;

    setCreatingAppointment(true);
    setMessage(null);

    try {
      if (isOfflineCustomerId(bookingCustomerId)) {
        const draft = customers.find(c => c.id === bookingCustomerId);
        if (!draft) return;
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createAppointment",
          payload: { branchId: selectedBranch.id, serviceId: bookingServiceId, roomId: bookingRoomId || undefined, employeeId: bookingEmployeeId || undefined, startAt: new Date(bookingStartAt).toISOString(), notes: bookingNotes || undefined, customerDraft: { fullName: draft.fullName, phone: draft.phone || undefined, email: draft.email || undefined } }
        });
        await refreshQueue();
        setBookingNotes(""); setBookingStartAt(defaultStartAtValue());
        setMessage("Booking queued.");
        return;
      }

      await tenantApi.reception.createAppointment({
        branchId: selectedBranch.id,
        customerId: bookingCustomerId,
        serviceId: bookingServiceId,
        roomId: bookingRoomId || undefined,
        employeeId: bookingEmployeeId || undefined,
        startAt: new Date(bookingStartAt).toISOString(),
        notes: bookingNotes || undefined
      });

      setBookingNotes("");
      setBookingStartAt(defaultStartAtValue());
      setMessage("Booking created.");
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createAppointment",
          payload: { branchId: selectedBranch.id, customerId: bookingCustomerId, serviceId: bookingServiceId, roomId: bookingRoomId || undefined, employeeId: bookingEmployeeId || undefined, startAt: new Date(bookingStartAt).toISOString(), notes: bookingNotes || undefined }
        });
        await refreshQueue();
        setBookingNotes("");
        setMessage("Saved offline.");
        return;
      }
      setMessage(issue instanceof ApiError ? issue.details.message : "Error creating booking.");
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    if (acknowledgementRequired || !selectedBranch) return;
    setUpdatingAppointmentId(id);
    try {
      await tenantApi.reception.updateAppointmentStatus(id, { status });
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      setMessage("Error updating status.");
    } finally {
      setUpdatingAppointmentId(null);
    }
  }

  async function acknowledgePolicy() {
    setAcknowledging(true);
    try {
      const updated = await tenantApi.policies.acknowledgeCurrent();
      setAcknowledgement(updated);
    } catch (issue) {
      setMessage("Error acknowledging.");
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Front Desk</Text>
            <Text style={styles.title}>{selectedBranch?.name || "Reception"}</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => router.push("/notifications" as never)} style={styles.iconButton}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/reception-waitlist" as never)} style={styles.iconButton}>
              <Text style={{ fontSize: 18 }}>⏳</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Stats / Queue */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Bookings</Text>
            <Text style={styles.statValue}>{appointments.length}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
            <Text style={styles.statLabel}>Queue Status</Text>
            <Pressable disabled={syncing} onPress={() => void syncQueue()} style={styles.syncBtn}>
              {syncing ? <ActivityIndicator size="small" /> : <Text style={styles.syncBtnText}>{queueCount} Sync</Text>}
            </Pressable>
          </View>
        </View>

        {/* Branch Selector */}
        {!isReceptionist && branches.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroll}>
            {branches.map(b => (
              <Pressable key={b.id} onPress={() => setSelectedBranchId(b.id)} style={[styles.branchChip, b.id === selectedBranch?.id && styles.branchChipActive]}>
                <Text style={[styles.branchChipText, b.id === selectedBranch?.id && styles.branchChipTextActive]}>{b.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Policy Notice */}
        {acknowledgement?.enabled && acknowledgementRequired && (
          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>{acknowledgement.title}</Text>
            <Pressable disabled={acknowledging} onPress={() => void acknowledgePolicy()} style={styles.acknowledgeBtn}>
              <Text style={styles.acknowledgeBtnText}>Acknowledge Policy</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#1D5C63" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Appointment List Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Appointments</Text>
              {appointments.length > 0 ? (
                appointments.map(apt => (
                  <View key={apt.id} style={styles.aptCard}>
                    <View style={styles.aptHeader}>
                      <Text style={styles.aptTime}>{new Date(apt.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: apt.status === 'confirmed' ? '#DBEAFE' : '#ECFDF5' }]}>
                        <Text style={styles.statusBadgeText}>{apt.status.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={styles.aptCustomer}>{apt.customerFullName}</Text>
                    <Text style={styles.aptService}>{apt.serviceName} • {apt.employeeCode || 'Unassigned'}</Text>
                    
                    <View style={styles.aptActions}>
                      {apt.status === 'confirmed' && (
                        <Pressable onPress={() => updateStatus(apt.id, 'checked_in')} style={styles.aptActionBtn}>
                          <Text style={styles.aptActionBtnText}>Check In</Text>
                        </Pressable>
                      )}
                      {apt.status === 'checked_in' && (
                        <Pressable onPress={() => updateStatus(apt.id, 'completed')} style={styles.aptActionBtn}>
                          <Text style={styles.aptActionBtnText}>Complete</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No appointments today.</Text></View>
              )}
            </View>

            {/* Quick Registration Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Registration</Text>
              <View style={styles.formCard}>
                <TextInput style={styles.input} placeholder="Full Name" value={customerName} onChangeText={setCustomerName} />
                <TextInput style={styles.input} placeholder="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
                <Pressable disabled={creatingCustomer || acknowledgementRequired} onPress={submitCustomer} style={[styles.submitBtn, acknowledgementRequired && styles.btnDisabled]}>
                  {creatingCustomer ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Create Customer</Text>}
                </Pressable>
              </View>
            </View>

            {/* Booking Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New Booking</Text>
              <View style={styles.formCard}>
                <Text style={styles.label}>Select Service</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {selectedBranch?.services.map(s => (
                    <Pressable key={s.id} onPress={() => setBookingServiceId(s.id)} style={[styles.pickerChip, s.id === bookingServiceId && styles.pickerChipActive]}>
                      <Text style={[styles.pickerChipText, s.id === bookingServiceId && styles.pickerChipTextActive]}>{s.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <TextInput style={styles.input} placeholder="Start Time (e.g. 14:00)" value={bookingStartAt} onChangeText={setBookingStartAt} />
                <Pressable disabled={creatingAppointment || acknowledgementRequired} onPress={submitAppointment} style={[styles.submitBtn, acknowledgementRequired && styles.btnDisabled]}>
                  {creatingAppointment ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Book Appointment</Text>}
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Pressable onPress={() => router.push("/owner")} style={styles.backBtn}><Text style={styles.backBtnText}>Exit Front Desk</Text></Pressable>
        </View>

        {message && <View style={styles.toast}><Text style={styles.toastText}>{message}</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headerIcons: { flexDirection: "row", gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "white", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  statsGrid: { flexDirection: "row", backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#E2E8F0" },
  statCard: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  syncBtn: { marginTop: 4, backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  syncBtnText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  branchScroll: { marginBottom: 24 },
  branchChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "white", marginRight: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  branchChipActive: { backgroundColor: "#1D5C63", borderColor: "#1D5C63" },
  branchChipText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  branchChipTextActive: { color: "white" },
  policyCard: { backgroundColor: "#FEF2F2", borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#FEE2E2" },
  policyTitle: { fontSize: 14, fontWeight: "700", color: "#991B1B", marginBottom: 12 },
  acknowledgeBtn: { backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  acknowledgeBtnText: { color: "white", fontWeight: "600" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  aptCard: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  aptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  aptTime: { fontSize: 14, fontWeight: "700", color: "#1D5C63" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: "#1E40AF" },
  aptCustomer: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  aptService: { fontSize: 14, color: "#64748B", marginBottom: 12 },
  aptActions: { flexDirection: "row", gap: 8 },
  aptActionBtn: { backgroundColor: "#1D5C63", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  aptActionBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
  formCard: { backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  input: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", color: "#0F172A" },
  label: { fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 8 },
  pickerScroll: { marginBottom: 16 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#F1F5F9", marginRight: 8 },
  pickerChipActive: { backgroundColor: "#1D5C63" },
  pickerChipText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  pickerChipTextActive: { color: "white" },
  submitBtn: { backgroundColor: "#1D5C63", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { color: "white", fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  emptyCard: { backgroundColor: "white", borderRadius: 16, padding: 32, alignItems: "center", borderStyle: "dashed", borderWidth: 1, borderColor: "#CBD5E1" },
  emptyText: { color: "#94A3B8", fontSize: 14 },
  footer: { marginTop: 12, marginBottom: 40 },
  backBtn: { paddingVertical: 12, alignItems: "center" },
  backBtnText: { color: "#64748B", fontWeight: "600" },
  toast: { position: "absolute", bottom: 20, left: 20, right: 20, backgroundColor: "#1E293B", padding: 16, borderRadius: 12 },
  toastText: { color: "white", fontSize: 14, textAlign: "center" }
});
