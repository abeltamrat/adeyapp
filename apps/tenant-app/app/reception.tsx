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

function nextActionsForStatus(status: AppointmentStatus, allowServiceProgression: boolean) {
  switch (status) {
    case "confirmed":
      return [
        { label: "Check in", status: "checked_in" as const },
        { label: "No show", status: "no_show" as const },
        { label: "Cancel", status: "canceled" as const }
      ];
    case "checked_in":
      return allowServiceProgression
        ? [
            { label: "Start service", status: "in_service" as const },
            { label: "Complete", status: "completed" as const }
          ]
        : [];
    case "in_service":
      return allowServiceProgression ? [{ label: "Complete", status: "completed" as const }] : [];
    default:
      return [];
  }
}

export default function ReceptionScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { queueCount, syncing, refreshQueue, syncQueue } = useOfflineQueue();
  const isReceptionist = session?.context?.role === "receptionist";
  const canAdvanceServiceProgress = !isReceptionist;
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
  const [assigningAppointmentId, setAssigningAppointmentId] = useState<string | null>(null);
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
        if (!active) {
          return;
        }

        const branchId =
          selectedBranchId || session?.context?.branchId || nextBranches[0]?.id || "";

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

        if (!active) {
          return;
        }

        setCustomers(nextCustomers);
        setEmployees(nextEmployees);
        setAppointments(nextAppointments);
        setAcknowledgement(nextAcknowledgement);
        setBookingCustomerId((current) => current || nextCustomers[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load reception data right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFrontDesk();

    return () => {
      active = false;
    };
  }, [selectedBranchId, session?.context?.branchId]);

  useEffect(() => {
    if (!selectedBranch) {
      setBookingServiceId("");
      setBookingRoomId("");
      return;
    }

    setBookingServiceId((current) =>
      current && selectedBranch.services.some((service) => service.id === current)
        ? current
        : selectedBranch.services[0]?.id || ""
    );

    setBookingRoomId((current) =>
      current && selectedBranch.rooms.some((room) => room.id === current)
        ? current
        : selectedBranch.rooms[0]?.id || ""
    );

    setBookingEmployeeId((current) =>
      current && employees.some((employee) => employee.id === current)
        ? current
        : employees[0]?.id || ""
    );
  }, [employees, selectedBranch]);

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
    setBookingCustomerId((current) => current || nextCustomers[0]?.id || "");
    setBookingEmployeeId((current) => current || nextEmployees[0]?.id || "");
    await refreshQueue();
  }

  async function submitCustomer() {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before creating customers.");
      return;
    }

    if (!selectedBranch || !customerName.trim()) {
      setMessage("Choose a branch and enter the customer name first.");
      return;
    }

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
      setMessage("Customer created and ready for booking.");
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        const offlineCustomerId = createOfflineCustomerId();
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createCustomer",
          payload: {
            branchId: selectedBranch.id,
            fullName: customerName,
            phone: customerPhone || undefined,
            email: customerEmail || undefined
          }
        });
        setCustomers((current) => [
          {
            id: offlineCustomerId,
            fullName: customerName,
            phone: customerPhone || null,
            email: customerEmail || null,
            primaryBranchId: selectedBranch.id,
            marketingConsent: false,
            notes: null,
            createdAt: new Date().toISOString()
          },
          ...current
        ]);
        await refreshQueue();
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setBookingCustomerId(offlineCustomerId);
        setMessage("No connection right now. Customer was saved to the offline queue.");
        return;
      }

      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the customer right now.");
      }
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function submitAppointment() {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before creating bookings.");
      return;
    }

    if (!selectedBranch || !bookingCustomerId || !bookingServiceId || !bookingStartAt.trim()) {
      setMessage("Choose the customer, service, and booking time first.");
      return;
    }

    if (selectedService?.requiresRoom && !bookingRoomId) {
      setMessage("This service needs a room before the booking can be saved.");
      return;
    }

    setCreatingAppointment(true);
    setMessage(null);

    try {
      if (isOfflineCustomerId(bookingCustomerId)) {
        const draftCustomer = customers.find((customer) => customer.id === bookingCustomerId);
        if (!draftCustomer) {
          setMessage("The selected offline customer draft could not be found.");
          return;
        }

        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createAppointment",
          payload: {
            branchId: selectedBranch.id,
            serviceId: bookingServiceId,
            roomId: bookingRoomId || undefined,
            employeeId: bookingEmployeeId || undefined,
            startAt: new Date(bookingStartAt).toISOString(),
            notes: bookingNotes || undefined,
            customerDraft: {
              fullName: draftCustomer.fullName,
              phone: draftCustomer.phone || undefined,
              email: draftCustomer.email || undefined
            }
          }
        });
        await refreshQueue();
        setBookingNotes("");
        setBookingStartAt(defaultStartAtValue());
        setMessage("Booking was queued and will create the customer first when it syncs.");
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
      setMessage("Booking created successfully.");
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: selectedBranch.id,
          kind: "reception.createAppointment",
          payload: {
            branchId: selectedBranch.id,
            customerId: bookingCustomerId,
            serviceId: bookingServiceId,
            roomId: bookingRoomId || undefined,
            employeeId: bookingEmployeeId || undefined,
            startAt: new Date(bookingStartAt).toISOString(),
            notes: bookingNotes || undefined
          }
        });
        await refreshQueue();
        setBookingNotes("");
        setBookingStartAt(defaultStartAtValue());
        setMessage("No connection right now. Booking was saved to the offline queue.");
        return;
      }

      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the booking right now.");
      }
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function assignEmployee(appointmentId: string, employeeId?: string) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before reassigning staff.");
      return;
    }

    if (!selectedBranch) {
      setMessage("Choose an active branch first.");
      return;
    }

    setAssigningAppointmentId(appointmentId);
    setMessage(null);

    try {
      await tenantApi.reception.assignAppointmentEmployee(appointmentId, { employeeId });
      setMessage(employeeId ? "Employee assigned successfully." : "Employee assignment cleared.");
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to assign the employee right now.");
      }
    } finally {
      setAssigningAppointmentId(null);
    }
  }

  async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before updating bookings.");
      return;
    }

    if (!selectedBranch) {
      setMessage("Choose an active branch first.");
      return;
    }

    setUpdatingAppointmentId(appointmentId);
    setMessage(null);

    try {
      await tenantApi.reception.updateAppointmentStatus(appointmentId, { status });
      setMessage(`Appointment moved to ${status.replace("_", " ")}.`);
      await refreshFrontDesk(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the appointment right now.");
      }
    } finally {
      setUpdatingAppointmentId(null);
    }
  }

  async function acknowledgePolicy() {
    setAcknowledging(true);
    setMessage(null);

    try {
      const updated = await tenantApi.policies.acknowledgeCurrent();
      setAcknowledgement(updated);
      setMessage("Workspace policy acknowledged.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to acknowledge the workspace policy right now.");
      }
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Reception</Text>
          <Text style={styles.title}>Front desk bookings</Text>
          <Text style={styles.copy}>
            Use the Expo app to register walk-ins, create customers, and reserve available rooms.
          </Text>
          <Text style={styles.meta}>
            Active workspace: {session?.tenants.find((tenant) => tenant.id === session?.context?.tenantId)?.name ?? "No workspace selected"}
          </Text>
          <Pressable onPress={() => router.push("/notifications" as never)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open inbox</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/reception-waitlist" as never)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open waitlist</Text>
          </Pressable>
          <View style={styles.queueCard}>
            <Text style={styles.sectionTitle}>Offline queue</Text>
            <Text style={styles.scheduleMeta}>
              {queueCount
                ? `${queueCount} front desk action(s) waiting to sync`
                : "No queued front desk actions"}
            </Text>
            <Pressable
              disabled={syncing}
              onPress={() => void syncQueue().then(async () => {
                if (selectedBranch) {
                  await refreshFrontDesk(selectedBranch.id);
                } else {
                  await refreshQueue();
                }
              })}
              style={styles.actionButtonSecondary}
            >
              {syncing ? (
                <ActivityIndicator color="#1D5C63" />
              ) : (
                <Text style={styles.actionButtonSecondaryText}>Sync queued actions</Text>
              )}
            </Pressable>
          </View>
          {acknowledgement?.enabled ? (
            <View style={styles.queueCard}>
              <Text style={styles.sectionTitle}>{acknowledgement.title}</Text>
              <Text style={styles.scheduleMeta}>Version {acknowledgement.version}</Text>
              <Text style={styles.scheduleMeta}>{acknowledgement.body}</Text>
              <Text style={styles.scheduleMeta}>
                {acknowledgementRequired
                  ? "Acknowledgement is required before front desk customer and booking actions continue."
                  : acknowledgement.acknowledged
                    ? `Acknowledged${acknowledgement.acknowledgedAt ? ` on ${new Date(acknowledgement.acknowledgedAt).toLocaleString()}` : ""}.`
                    : "Acknowledgement is available for this workspace."}
              </Text>
              {acknowledgementRequired ? (
                <Pressable
                  disabled={acknowledging}
                  onPress={() => void acknowledgePolicy()}
                  style={styles.primaryButton}
                >
                  {acknowledging ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Acknowledge policy</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : (
            <>
              <View style={styles.branchList}>
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => {
                      if (!isReceptionist) {
                        setSelectedBranchId(branch.id);
                      }
                    }}
                    style={[
                      styles.branchChip,
                      branch.id === selectedBranch?.id ? styles.branchChipActive : null,
                      isReceptionist && branch.id !== selectedBranch?.id ? styles.branchChipDisabled : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.branchChipText,
                        branch.id === selectedBranch?.id ? styles.branchChipTextActive : null
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selectedBranch ? (
                <>
                  <Text style={styles.sectionTitle}>Quick customer registration</Text>
                  <TextInput
                    onChangeText={setCustomerName}
                    placeholder="Customer full name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={customerName}
                  />
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={setCustomerPhone}
                    placeholder="Phone number"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={customerPhone}
                  />
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={setCustomerEmail}
                    placeholder="Email address"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={customerEmail}
                  />
                  <Pressable
                    disabled={creatingCustomer || acknowledgementRequired}
                    onPress={submitCustomer}
                    style={[
                      styles.primaryButton,
                      acknowledgementRequired ? styles.buttonDisabled : null
                    ]}
                  >
                    {creatingCustomer ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create customer</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Customers in {selectedBranch.name}</Text>
                  <View style={styles.listCard}>
                    {customers.length ? (
                      customers.map((customer) => (
                        <Pressable
                          key={customer.id}
                          onPress={() => setBookingCustomerId(customer.id)}
                          style={[
                            styles.selectorRow,
                            customer.id === bookingCustomerId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              customer.id === bookingCustomerId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {customer.fullName}
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              customer.id === bookingCustomerId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {isOfflineCustomerId(customer.id)
                              ? "Pending offline sync"
                              : customer.phone || customer.email || "No contact saved yet"}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No customers saved for this branch yet.</Text>
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>Create a booking</Text>
                  <Text style={styles.subtleLabel}>Choose a service</Text>
                  <View style={styles.selectorList}>
                    {selectedBranch.services.map((service) => (
                      <Pressable
                        key={service.id}
                        onPress={() => setBookingServiceId(service.id)}
                        style={[
                          styles.selectorRow,
                          service.id === bookingServiceId ? styles.selectorRowActive : null
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectorTitle,
                            service.id === bookingServiceId ? styles.selectorTitleActive : null
                          ]}
                        >
                          {service.name}
                        </Text>
                        <Text
                          style={[
                            styles.selectorMeta,
                            service.id === bookingServiceId ? styles.selectorMetaActive : null
                          ]}
                        >
                          {service.durationMinutes} min | {service.price}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.subtleLabel}>Choose a room</Text>
                  <View style={styles.selectorList}>
                    <Pressable
                      onPress={() => setBookingRoomId("")}
                      style={[styles.selectorRow, !bookingRoomId ? styles.selectorRowActive : null]}
                    >
                      <Text
                        style={[styles.selectorTitle, !bookingRoomId ? styles.selectorTitleActive : null]}
                      >
                        No room assigned yet
                      </Text>
                    </Pressable>
                    {selectedBranch.rooms.map((room) => (
                      <Pressable
                        key={room.id}
                        onPress={() => setBookingRoomId(room.id)}
                        style={[
                          styles.selectorRow,
                          room.id === bookingRoomId ? styles.selectorRowActive : null
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectorTitle,
                            room.id === bookingRoomId ? styles.selectorTitleActive : null
                          ]}
                        >
                          {room.name}
                        </Text>
                        <Text
                          style={[
                            styles.selectorMeta,
                            room.id === bookingRoomId ? styles.selectorMetaActive : null
                          ]}
                        >
                          {room.code} | Cleanup {room.cleanupBufferMinutes} min
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.subtleLabel}>Choose an employee</Text>
                  <View style={styles.selectorList}>
                    <Pressable
                      onPress={() => setBookingEmployeeId("")}
                      style={[styles.selectorRow, !bookingEmployeeId ? styles.selectorRowActive : null]}
                    >
                      <Text
                        style={[styles.selectorTitle, !bookingEmployeeId ? styles.selectorTitleActive : null]}
                      >
                        No employee assigned yet
                      </Text>
                    </Pressable>
                    {employees.map((employee) => (
                      <Pressable
                        key={employee.id}
                        onPress={() => setBookingEmployeeId(employee.id)}
                        style={[
                          styles.selectorRow,
                          employee.id === bookingEmployeeId ? styles.selectorRowActive : null
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectorTitle,
                            employee.id === bookingEmployeeId ? styles.selectorTitleActive : null
                          ]}
                        >
                          {employee.employeeCode}
                        </Text>
                        <Text
                          style={[
                            styles.selectorMeta,
                            employee.id === bookingEmployeeId ? styles.selectorMetaActive : null
                          ]}
                        >
                          {employee.email}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    onChangeText={setBookingStartAt}
                    placeholder="2026-04-21T14:00"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={bookingStartAt}
                  />
                  <TextInput
                    multiline
                    onChangeText={setBookingNotes}
                    placeholder="Reception notes"
                    placeholderTextColor="#8A918F"
                    style={[styles.input, styles.notesInput]}
                    value={bookingNotes}
                  />
                  <Pressable
                    disabled={creatingAppointment || acknowledgementRequired}
                    onPress={submitAppointment}
                    style={[
                      styles.primaryButton,
                      acknowledgementRequired ? styles.buttonDisabled : null
                    ]}
                  >
                    {creatingAppointment ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create booking</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Today's bookings</Text>
                  <View style={styles.listCard}>
                    {appointments.length ? (
                      appointments.map((appointment) => (
                        <View key={appointment.id} style={styles.scheduleRow}>
                          <Text style={styles.scheduleTime}>
                            {new Date(appointment.startAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </Text>
                          <View style={styles.scheduleBody}>
                            <Text style={styles.scheduleTitle}>{appointment.customerName}</Text>
                            <Text style={styles.scheduleMeta}>
                              {appointment.lines[0]?.serviceName || "Service"} |{" "}
                              {appointment.roomName || "Room pending"} |{" "}
                              {appointment.employeeCode || appointment.employeeEmail || "Staff pending"} |{" "}
                              {appointment.status}
                            </Text>
                            {appointment.checkInAt ? (
                              <Text style={styles.scheduleMeta}>
                                Checked in:{" "}
                                {new Date(appointment.checkInAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </Text>
                            ) : null}
                            {appointment.checkOutAt ? (
                              <Text style={styles.scheduleMeta}>
                                Closed:{" "}
                                {new Date(appointment.checkOutAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </Text>
                            ) : null}
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={assigningAppointmentId === appointment.id}
                                onPress={() =>
                                  void assignEmployee(
                                    appointment.id,
                                    employees.find((employee) => employee.id !== appointment.employeeId)?.id
                                  )
                                }
                                style={styles.actionButtonSecondary}
                              >
                                {assigningAppointmentId === appointment.id ? (
                                  <ActivityIndicator color="#1D5C63" />
                                ) : (
                                  <Text style={styles.actionButtonSecondaryText}>
                                    {appointment.employeeId ? "Swap staff" : "Assign staff"}
                                  </Text>
                                )}
                              </Pressable>
                              {appointment.employeeId ? (
                                <Pressable
                                  disabled={assigningAppointmentId === appointment.id}
                                  onPress={() => void assignEmployee(appointment.id, undefined)}
                                  style={styles.actionButtonSecondary}
                                >
                                  <Text style={styles.actionButtonSecondaryText}>Clear staff</Text>
                                </Pressable>
                              ) : null}
                              {nextActionsForStatus(appointment.status, canAdvanceServiceProgress).length ? (
                                nextActionsForStatus(appointment.status, canAdvanceServiceProgress).map((action) => (
                                  <Pressable
                                    key={action.status}
                                    disabled={
                                      updatingAppointmentId === appointment.id ||
                                      assigningAppointmentId === appointment.id
                                    }
                                    onPress={() =>
                                      void updateAppointmentStatus(appointment.id, action.status)
                                    }
                                    style={[
                                      styles.actionButton,
                                      action.status === "canceled" || action.status === "no_show"
                                        ? styles.actionButtonDanger
                                        : null
                                    ]}
                                  >
                                    {updatingAppointmentId === appointment.id ? (
                                      <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                      <Text style={styles.actionButtonText}>{action.label}</Text>
                                    )}
                                  </Pressable>
                                ))
                              ) : (
                                <Text style={styles.statusSettled}>
                                  {appointment.status === "completed"
                                    ? "Appointment completed"
                                    : appointment.status === "canceled"
                                      ? "Appointment canceled"
                                      : appointment.status === "no_show"
                                        ? "Marked as no show"
                                        : !canAdvanceServiceProgress &&
                                            (appointment.status === "checked_in" || appointment.status === "in_service")
                                          ? "Service progression is handled by manager or therapist"
                                        : "No further front desk actions"}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No bookings have been created for today yet.</Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No active branch is available for the front desk yet.</Text>
              )}
            </>
          )}

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
  meta: {
    color: "#5A4A35",
    fontSize: 14
  },
  branchList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  queueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 8
  },
  branchChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7CEC0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  branchChipActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  branchChipDisabled: {
    opacity: 0.45
  },
  branchChipText: {
    color: "#1D5C63",
    fontWeight: "600"
  },
  branchChipTextActive: {
    color: "#FFFFFF"
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  subtleLabel: {
    marginTop: 4,
    color: "#5A4A35",
    fontSize: 13,
    fontWeight: "600"
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
  notesInput: {
    minHeight: 92,
    textAlignVertical: "top"
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
  buttonDisabled: {
    opacity: 0.5
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 10
  },
  selectorList: {
    gap: 8
  },
  selectorRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 12,
    gap: 4
  },
  selectorRowActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  selectorTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  selectorTitleActive: {
    color: "#FFFFFF"
  },
  selectorMeta: {
    color: "#596467",
    fontSize: 13
  },
  selectorMetaActive: {
    color: "#D9F0EE"
  },
  scheduleRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  scheduleTime: {
    minWidth: 60,
    color: "#1D5C63",
    fontWeight: "700"
  },
  scheduleBody: {
    flex: 1,
    gap: 2
  },
  scheduleTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  scheduleMeta: {
    color: "#596467",
    fontSize: 13
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center"
  },
  actionButtonDanger: {
    backgroundColor: "#A33A2A"
  },
  actionButtonSecondary: {
    backgroundColor: "#E6EFEF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center"
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  actionButtonSecondaryText: {
    color: "#1D5C63",
    fontSize: 13,
    fontWeight: "700"
  },
  statusSettled: {
    color: "#5A4A35",
    fontSize: 13,
    fontWeight: "600"
  },
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
