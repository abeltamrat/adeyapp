import { ApiError } from "@adeyapp/api-client";
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

type BranchSetupSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listBranches>>[number];
type AttendanceSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listAttendance>>[number];

export default function OwnerAttendanceScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [records, setRecords] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) {
          return;
        }

        const branchId = selectedBranchId || nextBranches[0]?.id || "";
        const nextRecords = branchId
          ? await tenantApi.tenantManagement.listAttendance({
              branchId,
              date: new Date().toISOString().slice(0, 10)
            })
          : [];

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setSelectedBranchId(branchId);
        setRecords(nextRecords);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load attendance review right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttendance();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  async function runCorrection(
    record: AttendanceSummary,
    payload: Parameters<typeof tenantApi.tenantManagement.correctAttendance>[1]
  ) {
    setBusyRecordId(record.id);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.correctAttendance(record.id, payload);
      setRecords((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
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

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Attendance review</Text>
          <Text style={styles.copy}>
            Review who checked in, which network identifier was used, and who still has an open attendance session.
          </Text>

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : (
            <>
              <View style={styles.branchList}>
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => setSelectedBranchId(branch.id)}
                    style={[
                      styles.branchChip,
                      branch.id === selectedBranch?.id ? styles.branchChipActive : null
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

              <View style={styles.listCard}>
                {records.length ? (
                  records.map((record) => (
                    <View key={record.id} style={styles.recordCard}>
                      <Text style={styles.recordTitle}>
                        {record.employeeCode || "Employee"} | {record.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Shift: {record.shiftTemplateName || "No shift assignment"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Network: {record.networkIdentifier || "Not provided"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Lateness: {record.latenessMinutes} min
                        {record.exceptionFlag ? " | Exception flagged" : ""}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Check in:{" "}
                        {record.checkInAt
                          ? new Date(record.checkInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Not recorded"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Check out:{" "}
                        {record.checkOutAt
                          ? new Date(record.checkOutAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Open"}
                      </Text>
                      <Text style={styles.recordMeta}>
                        Status: {record.attendanceStatus}
                        {!record.checkOutAt ? " | Active now" : ""}
                      </Text>
                      <View style={styles.actionRow}>
                        {record.exceptionFlag || record.latenessMinutes > 0 ? (
                          <Pressable
                            onPress={() =>
                              runCorrection(record, {
                                attendanceStatus: "present",
                                latenessMinutes: 0,
                                exceptionFlag: false,
                                note: "Owner cleared lateness and exception"
                              })
                            }
                            disabled={busyRecordId === record.id}
                            style={[
                              styles.actionButton,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonText}>Forgive lateness</Text>
                          </Pressable>
                        ) : null}

                        {record.exceptionFlag ? (
                          <Pressable
                            onPress={() =>
                              runCorrection(record, {
                                attendanceStatus:
                                  record.latenessMinutes > 0 ? "late" : record.attendanceStatus,
                                exceptionFlag: false,
                                note: "Owner cleared attendance exception"
                              })
                            }
                            disabled={busyRecordId === record.id}
                            style={[
                              styles.actionButtonSecondary,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonSecondaryText}>Clear flag</Text>
                          </Pressable>
                        ) : null}

                        {!record.checkOutAt ? (
                          <Pressable
                            onPress={() =>
                              runCorrection(record, {
                                attendanceStatus:
                                  record.latenessMinutes > 0 ? "late" : record.attendanceStatus,
                                checkOutAt: new Date().toISOString(),
                                note: "Owner closed open attendance session"
                              })
                            }
                            disabled={busyRecordId === record.id}
                            style={[
                              styles.actionButtonSecondary,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonSecondaryText}>Close session</Text>
                          </Pressable>
                        ) : null}

                        {record.attendanceStatus !== "absent" ? (
                          <Pressable
                            onPress={() =>
                              runCorrection(record, {
                                attendanceStatus: "absent",
                                exceptionFlag: true,
                                note: "Owner marked attendance as absent"
                              })
                            }
                            disabled={busyRecordId === record.id}
                            style={[
                              styles.actionButtonDanger,
                              busyRecordId === record.id ? styles.actionButtonDisabled : null
                            ]}
                          >
                            <Text style={styles.actionButtonDangerText}>Mark absent</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No attendance records found for this branch today.</Text>
                )}
              </View>
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
  branchList: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  branchChipText: {
    color: "#1D5C63",
    fontWeight: "600"
  },
  branchChipTextActive: {
    color: "#FFFFFF"
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  actionButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButtonSecondary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C8B99D",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonSecondaryText: {
    color: "#5A4A35",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButtonDanger: {
    backgroundColor: "#7A2E2E",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonDangerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButtonDisabled: {
    opacity: 0.5
  },
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
