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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Manager Dashboard</Text>
            <Text style={styles.title}>Branch Operations</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => router.push("/notifications" as never)} style={styles.iconButton}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Exceptions</Text>
            <Text style={[styles.statValue, exceptionRecords.length > 0 ? { color: '#EF4444' } : null]}>
              {exceptionRecords.length}
            </Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
            <Text style={styles.statLabel}>Corrections</Text>
            <Text style={styles.statValue}>{corrections.length}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
            <Text style={styles.statLabel}>Total Staff</Text>
            <Text style={styles.statValue}>{employees.length}</Text>
          </View>
        </View>

        {/* Policy Notice */}
        {acknowledgement?.enabled && (
          <View style={styles.policyNotice}>
            <Text style={styles.sectionTitle}>{acknowledgement.title}</Text>
            <Text style={styles.policyBody} numberOfLines={2}>{acknowledgement.body}</Text>
            {acknowledgementRequired && (
              <Pressable
                disabled={acknowledging}
                onPress={() => void acknowledgePolicy()}
                style={styles.acknowledgeButton}
              >
                {acknowledging ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.acknowledgeButtonText}>Acknowledge Policy</Text>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* Loading / Main Content */}
        {loading ? (
          <ActivityIndicator color="#1D5C63" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Quick Actions */}
            <View style={styles.section}>
              <Pressable
                disabled={acknowledgementRequired}
                onPress={() => router.push("/reception")}
                style={[styles.primaryAction, acknowledgementRequired && styles.disabledAction]}
              >
                <Text style={styles.primaryActionIcon}>🛎️</Text>
                <Text style={styles.primaryActionText}>Open Front Desk</Text>
              </Pressable>
            </View>

            {/* Exceptions Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attendance Exceptions</Text>
              {exceptionRecords.length > 0 ? (
                exceptionRecords.map((record) => (
                  <View key={record.id} style={styles.recordCard}>
                    <View style={styles.recordHeader}>
                      <Text style={styles.employeeName}>{record.employeeCode || "Employee"}</Text>
                      <View style={[styles.badge, record.exceptionFlag ? styles.badgeDanger : styles.badgeWarning]}>
                        <Text style={styles.badgeText}>{record.attendanceStatus}</Text>
                      </View>
                    </View>
                    <Text style={styles.recordDetail}>
                      {record.shiftTemplateName || "No shift"} • Lateness: {record.latenessMinutes} min
                    </Text>
                    {!record.checkOutAt && <Text style={styles.statusPill}>Currently Checked In</Text>}
                    
                    <View style={styles.actionRow}>
                      {policies.managerCanCorrectAttendance && (
                        <>
                          <Pressable
                            onPress={() => void runCorrection(record, { attendanceStatus: "present", latenessMinutes: 0, exceptionFlag: false, note: "Manager cleared" })}
                            disabled={busyRecordId === record.id || acknowledgementRequired}
                            style={styles.actionBtn}
                          >
                            <Text style={styles.actionBtnText}>Resolve</Text>
                          </Pressable>
                          {!record.checkOutAt && (
                            <Pressable
                              onPress={() => void runCorrection(record, { checkOutAt: new Date().toISOString(), note: "Manager closed" })}
                              disabled={busyRecordId === record.id || acknowledgementRequired}
                              style={styles.actionBtnSecondary}
                            >
                              <Text style={styles.actionBtnSecondaryText}>Close</Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>All attendance is currently on track.</Text>
                </View>
              )}
            </View>

            {/* Staff Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Branch Staff</Text>
              {employees.map((employee) => (
                <View key={employee.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.employeeName}>{employee.employeeCode}</Text>
                    <Text style={styles.roleText}>{employee.roleType}</Text>
                  </View>
                  <Text style={styles.recordDetail}>{employee.email}</Text>
                  {policies.managerCanSuspendStaff && (
                    <View style={styles.actionRow}>
                      {employee.employmentStatus === "active" ? (
                        <Pressable
                          onPress={() => void updateEmployeeStatus(employee, "suspended_unpaid")}
                          disabled={busyEmployeeId === employee.id || acknowledgementRequired}
                          style={styles.actionBtnDanger}
                        >
                          <Text style={styles.actionBtnText}>Suspend</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => void updateEmployeeStatus(employee, "active")}
                          disabled={busyEmployeeId === employee.id || acknowledgementRequired}
                          style={styles.actionBtn}
                        >
                          <Text style={styles.actionBtnText}>Reactivate</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </Pressable>
        </View>

        {message && <View style={styles.toast}><Text style={styles.toastText}>{message}</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  policyNotice: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  policyBody: {
    fontSize: 14,
    color: "#1E40AF",
    marginTop: 4,
    marginBottom: 12,
  },
  acknowledgeButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  acknowledgeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  primaryAction: {
    flexDirection: "row",
    backgroundColor: "#1D5C63",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  disabledAction: {
    opacity: 0.5,
  },
  primaryActionIcon: {
    fontSize: 24,
  },
  primaryActionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  recordCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  roleText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  recordDetail: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 8,
  },
  statusPill: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
    backgroundColor: "#ECFDF5",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDanger: {
    backgroundColor: "#FEE2E2",
  },
  badgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#1D5C63",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionBtnSecondary: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionBtnDanger: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  actionBtnSecondaryText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  footer: {
    marginTop: 20,
    marginBottom: 40,
  },
  signOutBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutBtnText: {
    color: "#EF4444",
    fontWeight: "600",
  },
  toast: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  }
});

