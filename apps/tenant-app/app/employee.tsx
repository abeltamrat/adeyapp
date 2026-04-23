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
  enqueueOfflineAction,
  shouldQueueOffline
} from "../lib/offline-queue";
import { useOfflineQueue } from "../providers/offline-queue-provider";
import { useSession } from "../providers/session-provider";

type AppointmentSummary = Awaited<ReturnType<typeof tenantApi.employee.listAppointments>>[number];
type AttendanceSummary = Awaited<ReturnType<typeof tenantApi.employee.listAttendance>>[number];
type LeaveTypeSummary = Awaited<ReturnType<typeof tenantApi.employee.listLeaveTypes>>[number];
type LeaveBalanceSummary = Awaited<ReturnType<typeof tenantApi.employee.listLeaveBalances>>[number];
type LeaveRequestSummary = Awaited<ReturnType<typeof tenantApi.employee.listLeaveRequests>>[number];
type CreditRequestSummary = Awaited<ReturnType<typeof tenantApi.employee.listCreditRequests>>[number];
type PolicyRole = "manager" | "receptionist" | "employee";

function isPolicyRole(value?: string): value is PolicyRole {
  return value === "manager" || value === "receptionist" || value === "employee";
}

export default function EmployeeScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { queueCount, queueLabels, syncing, refreshQueue, syncQueue } = useOfflineQueue();
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSummary[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeSummary[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestSummary[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequestSummary[]>([]);
  const [acknowledgement, setAcknowledgement] = useState<
    Awaited<ReturnType<typeof tenantApi.policies.getCurrentAcknowledgement>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState<"check-in" | "check-out" | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [submittingLeaveRequest, setSubmittingLeaveRequest] = useState(false);
  const [submittingCreditRequest, setSubmittingCreditRequest] = useState(false);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("0");
  const [creditReason, setCreditReason] = useState("");
  const [networkIdentifier, setNetworkIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const currentRole = session?.context?.role;

  const activeAttendance = useMemo(
    () => attendanceRecords.find((record) => !record.checkOutAt) ?? null,
    [attendanceRecords]
  );
  const acknowledgementRequired = Boolean(
    acknowledgement?.enabled &&
      isPolicyRole(currentRole) &&
      acknowledgement.requiredRoles.includes(currentRole) &&
      !acknowledgement.acknowledged
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setMessage(null);

      try {
        const today = new Date().toISOString().slice(0, 10);
        const [nextAppointments, nextAttendance, nextAcknowledgement, nextLeaveTypes, nextLeaveBalances, nextLeaveRequests, nextCreditRequests] = await Promise.all([
          tenantApi.employee.listAppointments({ date: today }),
          tenantApi.employee.listAttendance({ date: today }),
          tenantApi.policies.getCurrentAcknowledgement(),
          tenantApi.employee.listLeaveTypes(),
          tenantApi.employee.listLeaveBalances(),
          tenantApi.employee.listLeaveRequests(),
          tenantApi.employee.listCreditRequests()
        ]);
        if (!active) {
          return;
        }

        setAppointments(nextAppointments);
        setAttendanceRecords(nextAttendance);
        setAcknowledgement(nextAcknowledgement);
        setLeaveTypes(nextLeaveTypes);
        setLeaveBalances(nextLeaveBalances);
        setLeaveRequests(nextLeaveRequests);
        setCreditRequests(nextCreditRequests);
        setSelectedLeaveTypeId((current) => current || nextLeaveTypes[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load assigned services right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function refreshData() {
    const today = new Date().toISOString().slice(0, 10);
    const [nextAppointments, nextAttendance, nextAcknowledgement, nextLeaveTypes, nextLeaveBalances, nextLeaveRequests, nextCreditRequests] = await Promise.all([
      tenantApi.employee.listAppointments({ date: today }),
      tenantApi.employee.listAttendance({ date: today }),
      tenantApi.policies.getCurrentAcknowledgement(),
      tenantApi.employee.listLeaveTypes(),
      tenantApi.employee.listLeaveBalances(),
      tenantApi.employee.listLeaveRequests(),
      tenantApi.employee.listCreditRequests()
    ]);
    setAppointments(nextAppointments);
    setAttendanceRecords(nextAttendance);
    setAcknowledgement(nextAcknowledgement);
    setLeaveTypes(nextLeaveTypes);
    setLeaveBalances(nextLeaveBalances);
    setLeaveRequests(nextLeaveRequests);
    setCreditRequests(nextCreditRequests);
    setSelectedLeaveTypeId((current) => current || nextLeaveTypes[0]?.id || "");
    await refreshQueue();
  }

  async function startService(appointmentId: string) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before starting services.");
      return;
    }

    setBusyAppointmentId(appointmentId);
    setMessage(null);

    try {
      await tenantApi.employee.startService(appointmentId);
      setMessage("Service started.");
      await refreshData();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to start this service right now.");
      }
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function completeService(appointmentId: string) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before completing services.");
      return;
    }

    setBusyAppointmentId(appointmentId);
    setMessage(null);

    try {
      await tenantApi.employee.completeService(appointmentId);
      setMessage("Service completed.");
      await refreshData();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to complete this service right now.");
      }
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function checkIn() {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before checking in.");
      return;
    }

    setAttendanceSubmitting("check-in");
    setMessage(null);

    try {
      await tenantApi.employee.checkIn({
        networkIdentifier: networkIdentifier || undefined
      });
      setMessage("Attendance check-in successful.");
      await refreshData();
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: session?.context?.branchId,
          kind: "employee.checkIn",
          payload: {
            networkIdentifier: networkIdentifier || undefined
          }
        });
        await refreshQueue();
        setMessage("No connection right now. Attendance check-in was queued for sync.");
        return;
      }

      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to check in right now.");
      }
    } finally {
      setAttendanceSubmitting(null);
    }
  }

  async function checkOut() {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before checking out.");
      return;
    }

    setAttendanceSubmitting("check-out");
    setMessage(null);

    try {
      await tenantApi.employee.checkOut({
        networkIdentifier: networkIdentifier || undefined
      });
      setMessage("Attendance check-out successful.");
      await refreshData();
    } catch (issue) {
      if (shouldQueueOffline(issue)) {
        await enqueueOfflineAction({
          tenantId: session?.context?.tenantId ?? "",
          userId: session?.user.id ?? "",
          branchId: session?.context?.branchId,
          kind: "employee.checkOut",
          payload: {
            networkIdentifier: networkIdentifier || undefined
          }
        });
        await refreshQueue();
        setMessage("No connection right now. Attendance check-out was queued for sync.");
        return;
      }

      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to check out right now.");
      }
    } finally {
      setAttendanceSubmitting(null);
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

  async function submitLeaveRequest() {
    if (!selectedLeaveTypeId || !leaveStartDate.trim() || !leaveEndDate.trim()) {
      setMessage("Choose the leave type and leave dates first.");
      return;
    }

    setSubmittingLeaveRequest(true);
    setMessage(null);

    try {
      await tenantApi.employee.createLeaveRequest({
        leaveTypeId: selectedLeaveTypeId,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim() || undefined
      });
      setLeaveReason("");
      setMessage("Leave request submitted.");
      await refreshData();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to submit the leave request right now.");
      }
    } finally {
      setSubmittingLeaveRequest(false);
    }
  }

  async function submitCreditRequest() {
    if (!creditAmount.trim() || Number(creditAmount) <= 0) {
      setMessage("Enter a credit amount greater than zero first.");
      return;
    }

    setSubmittingCreditRequest(true);
    setMessage(null);

    try {
      await tenantApi.employee.createCreditRequest({
        amount: Number(creditAmount),
        reason: creditReason.trim() || undefined
      });
      setCreditAmount("0");
      setCreditReason("");
      setMessage("Credit request submitted.");
      await refreshData();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to submit the credit request right now.");
      }
    } finally {
      setSubmittingCreditRequest(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Employee</Text>
          <Text style={styles.title}>Today's assigned services</Text>
          <Text style={styles.copy}>
            This Expo view lets the assigned employee start and complete services from the cPanel-safe PHP API.
          </Text>
          <Text style={styles.note}>
            For the managed Expo path, attendance uses a manual network identifier entry for now. We can replace this later with device-detected Wi-Fi data once we add a native-compatible solution.
          </Text>
          <Text style={styles.meta}>
            Active workspace:{" "}
            {session?.tenants.find((tenant) => tenant.id === session?.context?.tenantId)?.name ??
              "No workspace selected"}
          </Text>
          <Pressable onPress={() => router.push("/notifications" as never)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open inbox</Text>
          </Pressable>
          <View style={styles.queueCard}>
            <Text style={styles.sectionTitle}>Offline queue</Text>
            <Text style={styles.assignmentMeta}>
              {queueCount
                ? `${queueCount} action(s) waiting to sync`
                : "No queued employee actions"}
            </Text>
            <Pressable
              disabled={syncing}
              onPress={() => void syncQueue().then(refreshData)}
              style={styles.secondaryButton}
            >
              {syncing ? (
                <ActivityIndicator color="#1D5C63" />
              ) : (
                <Text style={styles.secondaryButtonText}>Sync queued actions</Text>
              )}
            </Pressable>
          </View>
          {acknowledgement?.enabled ? (
            <View style={styles.queueCard}>
              <Text style={styles.sectionTitle}>{acknowledgement.title}</Text>
              <Text style={styles.assignmentMeta}>Version {acknowledgement.version}</Text>
              <Text style={styles.assignmentMeta}>{acknowledgement.body}</Text>
              <Text style={styles.assignmentMeta}>
                {acknowledgementRequired
                  ? "Acknowledgement is required before attendance and service actions continue."
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
              <View style={styles.attendanceCard}>
                <Text style={styles.sectionTitle}>Attendance</Text>
                <Text style={styles.attendanceStatus}>
                  {activeAttendance
                    ? `Checked in at ${new Date(activeAttendance.checkInAt ?? "").toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}`
                    : "Not checked in yet today"}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setNetworkIdentifier}
                  placeholder="Approved network identifier"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={networkIdentifier}
                />
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={attendanceSubmitting !== null || !!activeAttendance || acknowledgementRequired}
                    onPress={() => void checkIn()}
                    style={[
                      styles.primaryButton,
                      activeAttendance || acknowledgementRequired ? styles.buttonDisabled : null
                    ]}
                  >
                    {attendanceSubmitting === "check-in" ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Check in</Text>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={attendanceSubmitting !== null || !activeAttendance || acknowledgementRequired}
                    onPress={() => void checkOut()}
                    style={[
                      styles.secondaryButton,
                      !activeAttendance || acknowledgementRequired ? styles.buttonDisabledLight : null
                    ]}
                  >
                    {attendanceSubmitting === "check-out" ? (
                      <ActivityIndicator color="#1D5C63" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Check out</Text>
                    )}
                  </Pressable>
                </View>
                <View style={styles.historyList}>
                  {attendanceRecords.length ? (
                    attendanceRecords.map((record) => (
                      <Text key={record.id} style={styles.assignmentMeta}>
                        {record.shiftTemplateName || "No shift"} |{" "}
                        {record.networkIdentifier || "No network saved"} |{" "}
                        Late {record.latenessMinutes} min |{" "}
                        {record.checkInAt
                          ? new Date(record.checkInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "No check-in"}
                        {" -> "}
                        {record.checkOutAt
                          ? new Date(record.checkOutAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Open"}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No attendance records saved for today yet.</Text>
                  )}
                </View>
              </View>

              <View style={styles.listCard}>
                <Text style={styles.sectionTitle}>Leave desk</Text>
                <View style={styles.historyList}>
                  {leaveTypes.length ? (
                    leaveTypes.map((leaveType) => (
                      <Pressable
                        key={leaveType.id}
                        onPress={() => setSelectedLeaveTypeId(leaveType.id)}
                        style={[
                          styles.assignmentCard,
                          leaveType.id === selectedLeaveTypeId ? styles.selectedCard : null
                        ]}
                      >
                        <Text style={styles.assignmentTitle}>{leaveType.name}</Text>
                        <Text style={styles.assignmentMeta}>
                          {leaveType.code} | Default {leaveType.defaultBalanceDays} day(s)
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No leave types are available for this branch yet.</Text>
                  )}
                </View>
                <View style={styles.historyList}>
                  {leaveBalances.length ? (
                    leaveBalances.map((balance) => (
                      <Text key={balance.id} style={styles.assignmentMeta}>
                        {balance.leaveTypeName}: {balance.balanceDays} available | {balance.usedDays} used
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No leave balances have been assigned yet.</Text>
                  )}
                </View>
                <TextInput
                  onChangeText={setLeaveStartDate}
                  placeholder="Leave start YYYY-MM-DD"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={leaveStartDate}
                />
                <TextInput
                  onChangeText={setLeaveEndDate}
                  placeholder="Leave end YYYY-MM-DD"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={leaveEndDate}
                />
                <TextInput
                  onChangeText={setLeaveReason}
                  placeholder="Leave reason"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={leaveReason}
                />
                <Pressable
                  disabled={submittingLeaveRequest}
                  onPress={() => void submitLeaveRequest()}
                  style={styles.primaryButton}
                >
                  {submittingLeaveRequest ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit leave request</Text>
                  )}
                </Pressable>
                <View style={styles.historyList}>
                  {leaveRequests.length ? (
                    leaveRequests.map((request) => (
                      <Text key={request.id} style={styles.assignmentMeta}>
                        {request.leaveTypeName}: {request.startDate} {"->"} {request.endDate} | {request.status}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No leave requests submitted yet.</Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Employee credit</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setCreditAmount}
                  placeholder="Credit request amount"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={creditAmount}
                />
                <TextInput
                  onChangeText={setCreditReason}
                  placeholder="Credit request reason"
                  placeholderTextColor="#8A918F"
                  style={styles.input}
                  value={creditReason}
                />
                <Pressable
                  disabled={submittingCreditRequest}
                  onPress={() => void submitCreditRequest()}
                  style={styles.primaryButton}
                >
                  {submittingCreditRequest ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit credit request</Text>
                  )}
                </Pressable>
                <View style={styles.historyList}>
                  {creditRequests.length ? (
                    creditRequests.map((request) => (
                      <Text key={request.id} style={styles.assignmentMeta}>
                        {request.amount} requested | Outstanding {request.outstandingAmount} | {request.status}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No employee credit requests submitted yet.</Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Assigned services</Text>
                {appointments.length ? (
                  appointments.map((appointment) => (
                    <View key={appointment.id} style={styles.assignmentCard}>
                      <Text style={styles.assignmentTime}>
                        {new Date(appointment.startAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </Text>
                      <Text style={styles.assignmentTitle}>{appointment.customerName}</Text>
                      <Text style={styles.assignmentMeta}>
                        {appointment.lines[0]?.serviceName || "Service"} |{" "}
                        {appointment.roomName || "Room pending"} | {appointment.status}
                      </Text>
                      {appointment.checkInAt ? (
                        <Text style={styles.assignmentMeta}>
                          Checked in:{" "}
                          {new Date(appointment.checkInAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Text>
                      ) : null}
                      {appointment.checkOutAt ? (
                        <Text style={styles.assignmentMeta}>
                          Completed:{" "}
                          {new Date(appointment.checkOutAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Text>
                      ) : null}
                      <View style={styles.actionRow}>
                        {appointment.status === "confirmed" || appointment.status === "checked_in" ? (
                          <Pressable
                            disabled={busyAppointmentId === appointment.id || acknowledgementRequired}
                            onPress={() => void startService(appointment.id)}
                            style={[
                              styles.primaryButton,
                              acknowledgementRequired ? styles.buttonDisabled : null
                            ]}
                          >
                            {busyAppointmentId === appointment.id ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.primaryButtonText}>Start service</Text>
                            )}
                          </Pressable>
                        ) : null}
                        {appointment.status === "checked_in" || appointment.status === "in_service" ? (
                          <Pressable
                            disabled={busyAppointmentId === appointment.id || acknowledgementRequired}
                            onPress={() => void completeService(appointment.id)}
                            style={[
                              styles.secondaryButton,
                              acknowledgementRequired ? styles.buttonDisabledLight : null
                            ]}
                          >
                            {busyAppointmentId === appointment.id ? (
                              <ActivityIndicator color="#1D5C63" />
                            ) : (
                              <Text style={styles.secondaryButtonText}>Complete service</Text>
                            )}
                          </Pressable>
                        ) : null}
                        {appointment.status === "completed" ? (
                          <Text style={styles.statusNote}>Finished</Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No appointments are assigned to this employee for today.</Text>
                )}
              </View>
            </>
          )}

          <Pressable onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutButtonText}>Sign out</Text>
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
  note: {
    color: "#6A624D",
    fontSize: 13,
    lineHeight: 20
  },
  meta: {
    color: "#5A4A35",
    fontSize: 14
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  attendanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 16,
    gap: 10
  },
  queueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 16,
    gap: 10
  },
  attendanceStatus: {
    color: "#1D5C63",
    fontWeight: "700"
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
  listCard: {
    gap: 12
  },
  historyList: {
    gap: 6
  },
  assignmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 16,
    gap: 6
  },
  selectedCard: {
    borderColor: "#1D5C63",
    backgroundColor: "#F2FAFA"
  },
  assignmentTime: {
    color: "#1D5C63",
    fontWeight: "700"
  },
  assignmentTitle: {
    color: "#1E1E1E",
    fontSize: 18,
    fontWeight: "700"
  },
  assignmentMeta: {
    color: "#596467",
    fontSize: 13
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 124,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#E6EFEF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 136,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonDisabledLight: {
    opacity: 0.6
  },
  secondaryButtonText: {
    color: "#1D5C63",
    fontSize: 14,
    fontWeight: "700"
  },
  statusNote: {
    color: "#5A4A35",
    fontSize: 13,
    fontWeight: "700"
  },
  signOutButton: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 12
  },
  signOutButtonText: {
    color: "#1D5C63",
    fontWeight: "700"
  },
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
