import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { tenantApi } from "../lib/api";
import { useSession } from "../providers/session-provider";
import type { EmployeeSummary as EmployeeSummaryType } from "@adeyapp/types";

type AttendanceSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listAttendance>>[number];
type AttendanceCorrectionSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listAttendanceCorrections>
>[number];
type EmployeeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listEmployees>>[number];
type PolicyRole = "manager" | "receptionist" | "employee";

function isPolicyRole(value?: string): value is PolicyRole {
  return value === "manager" || value === "receptionist" || value === "employee";
}

export default function ManagerScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [records, setRecords] = useState<AttendanceSummary[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [policies, setPolicies] = useState({
    managerCanCorrectAttendance: true,
    managerCanSuspendStaff: true
  });
  const [acknowledgement, setAcknowledgement] = useState<
    Awaited<ReturnType<typeof tenantApi.policies.getCurrentAcknowledgement>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentRole = session?.context?.role;
  const acknowledgementRequired = Boolean(
    acknowledgement?.enabled &&
      isPolicyRole(currentRole) &&
      acknowledgement.requiredRoles.includes(currentRole) &&
      !acknowledgement.acknowledged
  );

  async function refreshManagerDesk(branchId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [nextRecords, nextCorrections, nextEmployees, nextPolicies, nextAcknowledgement] = await Promise.all([
      tenantApi.tenantManagement.listAttendance({ branchId, date: today }),
      tenantApi.tenantManagement.listAttendanceCorrections({
        branchId,
        fromDate: today,
        toDate: today
      }),
      tenantApi.tenantManagement.listEmployees({ branchId }),
      tenantApi.tenantManagement.getOperationPolicies(),
      tenantApi.policies.getCurrentAcknowledgement()
    ]);

    setRecords(nextRecords);
    setCorrections(nextCorrections);
    setEmployees(nextEmployees);
    setPolicies(nextPolicies);
    setAcknowledgement(nextAcknowledgement);
  }

  useEffect(() => {
    let active = true;

    async function loadManagerDesk() {
      setLoading(true);
      setMessage(null);

      try {
        const branchId = session?.context?.branchId;
        if (!branchId) {
          if (active) {
            setRecords([]);
            setCorrections([]);
            setLoading(false);
          }
          return;
        }

        if (!active) {
          return;
        }

        await refreshManagerDesk(branchId);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load manager operations right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadManagerDesk();

    return () => {
      active = false;
    };
  }, [session?.context?.branchId]);

  const exceptionRecords = records.filter(
    (record) => record.exceptionFlag || record.latenessMinutes > 0 || !record.checkOutAt
  );

  async function runCorrection(
    record: AttendanceSummary,
    payload: Parameters<typeof tenantApi.tenantManagement.correctAttendance>[1]
  ) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before correcting attendance.");
      return;
    }

    const branchId = session?.context?.branchId;
    if (!branchId) {
      setMessage("No branch context is available for this manager.");
      return;
    }

    setBusyRecordId(record.id);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.correctAttendance(record.id, payload);
      await refreshManagerDesk(branchId);
      setMessage(`Attendance updated for ${record.employeeCode || record.employeeEmail || "employee"}.`);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update attendance right now.");
      }
    } finally {
      setBusyRecordId(null);
    }
  }

  async function updateEmployeeStatus(
    employee: EmployeeSummary,
    employmentStatus: EmployeeSummaryType["employmentStatus"]
  ) {
    if (acknowledgementRequired) {
      setMessage("Acknowledge the latest workspace policy before updating staff status.");
      return;
    }

    setBusyEmployeeId(employee.id);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateEmployeeStatus(employee.id, {
        employmentStatus
      });
      setEmployees((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setMessage(
        `${employee.employeeCode || employee.email || "Employee"} is now ${employmentStatus.replace("_", " ")}.`
      );
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update employee status right now.");
      }
    } finally {
      setBusyEmployeeId(null);
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
          <Text style={styles.eyebrow}>Manager</Text>
          <Text style={styles.title}>Branch operations desk</Text>
          <Text style={styles.copy}>
            Review attendance exceptions, open staff sessions, and jump straight into front desk booking control.
          </Text>
          <Text style={styles.meta}>
            Active branch: {session?.context?.branchId ?? "No branch context"}
          </Text>

          <Pressable
            disabled={acknowledgementRequired}
            onPress={() => router.push("/reception")}
            style={[styles.primaryButton, acknowledgementRequired ? styles.buttonDisabled : null]}
          >
            <Text style={styles.primaryButtonText}>Open front desk</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/notifications" as never)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open inbox</Text>
          </Pressable>
          {acknowledgement?.enabled ? (
            <View style={styles.listCard}>
              <Text style={styles.sectionTitle}>{acknowledgement.title}</Text>
              <Text style={styles.recordMeta}>Version {acknowledgement.version}</Text>
              <Text style={styles.recordMeta}>{acknowledgement.body}</Text>
              <Text style={styles.recordMeta}>
                {acknowledgementRequired
                  ? "Acknowledgement is required before manager attendance and staff actions continue."
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
              <Text style={styles.sectionTitle}>Attendance exceptions</Text>
              <View style={styles.listCard}>
                {exceptionRecords.length ? (
                  exceptionRecords.map((record) => (
                    <View key={record.id} style={styles.recordCard}>
                      <Text style={styles.recordTitle}>
                        {record.employeeCode || "Employee"} | {record.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Status: {record.attendanceStatus}
                        {!record.checkOutAt ? " | Open session" : ""}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Shift: {record.shiftTemplateName || "No shift"} | Lateness: {record.latenessMinutes} min
                      </Text>
                      <Text style={styles.recordMeta}>
                        Network: {record.networkIdentifier || "Not provided"}
                      </Text>
                      <View style={styles.actionRow}>
                        {policies.managerCanCorrectAttendance &&
                          (record.exceptionFlag || record.latenessMinutes > 0) && (
                          <Pressable
                            onPress={() =>
                              void runCorrection(record, {
                                attendanceStatus: "present",
                                latenessMinutes: 0,
                                exceptionFlag: false,
                                note: "Manager cleared lateness and flag"
                              })
                            }
                            disabled={busyRecordId === record.id || acknowledgementRequired}
                            style={[
                              styles.actionButton,
                              acknowledgementRequired ? styles.actionButtonDisabled : null,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonText}>Resolve</Text>
                          </Pressable>
                        )}
                        {policies.managerCanCorrectAttendance && !record.checkOutAt && (
                          <Pressable
                            onPress={() =>
                              void runCorrection(record, {
                                checkOutAt: new Date().toISOString(),
                                note: "Manager closed open attendance session"
                              })
                            }
                            disabled={busyRecordId === record.id || acknowledgementRequired}
                            style={[
                              styles.actionButtonSecondary,
                              acknowledgementRequired ? styles.actionButtonDisabled : null,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonSecondaryText}>Close session</Text>
                          </Pressable>
                        )}
                        {policies.managerCanCorrectAttendance && record.attendanceStatus !== "absent" && (
                          <Pressable
                            onPress={() =>
                              void runCorrection(record, {
                                attendanceStatus: "absent",
                                exceptionFlag: true,
                                note: "Manager marked attendance absent"
                              })
                            }
                            disabled={busyRecordId === record.id || acknowledgementRequired}
                            style={[
                              styles.actionButtonDanger,
                              acknowledgementRequired ? styles.actionButtonDisabled : null,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonText}>Mark absent</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No active exceptions for this branch today.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Today's corrections</Text>
              <View style={styles.listCard}>
                {corrections.length ? (
                  corrections.map((item) => (
                    <View key={item.id} style={styles.recordCard}>
                      <Text style={styles.recordTitle}>
                        {item.employeeCode || "Employee"} | {item.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        {item.fromStatus || "unknown"} {"->"} {item.toStatus || "unknown"} by {item.actorEmail || "unknown"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Lateness: {item.fromLatenessMinutes} {"->"} {item.toLatenessMinutes} min
                      </Text>
                      {item.note ? <Text style={styles.recordMeta}>Note: {item.note}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No attendance corrections recorded today.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Branch staff roster</Text>
              <View style={styles.listCard}>
                {employees.length ? (
                  employees.map((employee) => (
                    <View key={employee.id} style={styles.recordCard}>
                      <Text style={styles.recordTitle}>
                        {employee.employeeCode} | {employee.email}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Role: {employee.roleType} | Status: {employee.employmentStatus}
                      </Text>
                      {policies.managerCanSuspendStaff ? (
                        <View style={styles.actionRow}>
                          {employee.employmentStatus !== "active" ? (
                              <Pressable
                                onPress={() => void updateEmployeeStatus(employee, "active")}
                                disabled={busyEmployeeId === employee.id || acknowledgementRequired}
                              style={[
                                styles.actionButton,
                                acknowledgementRequired ? styles.actionButtonDisabled : null,
                                busyEmployeeId === employee.id ? styles.actionButtonDisabled : null
                              ]}
                            >
                              <Text style={styles.actionButtonText}>Reactivate</Text>
                            </Pressable>
                          ) : (
                            <>
                              <Pressable
                                onPress={() => void updateEmployeeStatus(employee, "suspended_paid")}
                                disabled={busyEmployeeId === employee.id || acknowledgementRequired}
                                style={[
                                  styles.actionButtonSecondary,
                                  acknowledgementRequired ? styles.actionButtonDisabled : null,
                                  busyEmployeeId === employee.id ? styles.actionButtonDisabled : null
                                ]}
                              >
                                <Text style={styles.actionButtonSecondaryText}>Suspend paid</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => void updateEmployeeStatus(employee, "suspended_unpaid")}
                                disabled={busyEmployeeId === employee.id || acknowledgementRequired}
                                style={[
                                  styles.actionButtonDanger,
                                  acknowledgementRequired ? styles.actionButtonDisabled : null,
                                  busyEmployeeId === employee.id ? styles.actionButtonDisabled : null
                                ]}
                              >
                                <Text style={styles.actionButtonText}>Suspend unpaid</Text>
                              </Pressable>
                            </>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.recordMeta}>Staff suspension is disabled by owner policy.</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No staff found for this branch.</Text>
                )}
              </View>
            </>
          )}

          <Pressable onPress={signOut} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Sign out</Text>
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
  meta: {
    color: "#5A4A35",
    fontSize: 14
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  listCard: {
    gap: 10
  },
  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 4
  },
  recordTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  recordMeta: {
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
    paddingVertical: 9
  },
  actionButtonSecondary: {
    backgroundColor: "#E6EFEF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonDanger: {
    backgroundColor: "#A33A2A",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButtonSecondaryText: {
    color: "#1D5C63",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButtonDisabled: {
    opacity: 0.5
  },
  emptyText: {
    color: "#7B8587"
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: "center"
  },
  ghostButtonText: {
    color: "#1D5C63",
    fontWeight: "700"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
