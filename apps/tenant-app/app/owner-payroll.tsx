import { ApiError } from "@adeyapp/api-client";
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
import { tenantApi } from "../lib/api";

type BranchSetupSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listBranches>>[number];
type AttendancePayrollSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listAttendancePayrollSummary>
>[number];
type AttendanceCorrectionSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listAttendanceCorrections>
>[number];
type AttendancePayrollSnapshotSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listAttendancePayrollSnapshots>
>[number];
type CreditRequestSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listCreditRequests>>[number];
type PayrollBatchSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listPayrollBatches>>[number];

function currentMonthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function OwnerPayrollScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [fromDate, setFromDate] = useState(currentMonthStart());
  const [toDate, setToDate] = useState(currentDate());
  const [snapshotNote, setSnapshotNote] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [latePenaltyPerMinute, setLatePenaltyPerMinute] = useState("0");
  const [includeCreditDeductions, setIncludeCreditDeductions] = useState(true);
  const [summary, setSummary] = useState<AttendancePayrollSummary[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionSummary[]>([]);
  const [snapshots, setSnapshots] = useState<AttendancePayrollSnapshotSummary[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequestSummary[]>([]);
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [creatingPayrollBatch, setCreatingPayrollBatch] = useState(false);
  const [updatingCreditRequestId, setUpdatingCreditRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPayrollAttendance() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) {
          return;
        }

        const branchId = selectedBranchId || nextBranches[0]?.id || "";
        const [nextSummary, nextCorrections, nextSnapshots, nextCreditRequests, nextPayrollBatches] = branchId
          ? await Promise.all([
              tenantApi.tenantManagement.listAttendancePayrollSummary({
                branchId,
                fromDate,
                toDate
              }),
              tenantApi.tenantManagement.listAttendanceCorrections({
                branchId,
                fromDate,
                toDate
              }),
              tenantApi.tenantManagement.listAttendancePayrollSnapshots({
                branchId,
                fromDate,
                toDate
              }),
              tenantApi.tenantManagement.listCreditRequests({
                branchId
              }),
              tenantApi.tenantManagement.listPayrollBatches({
                branchId,
                fromDate,
                toDate
              })
            ])
          : [[], [], [], [], []];

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setSelectedBranchId(branchId);
        setSummary(nextSummary);
        setCorrections(nextCorrections);
        setSnapshots(nextSnapshots);
        setCreditRequests(nextCreditRequests);
        setPayrollBatches(nextPayrollBatches);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load payroll attendance right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPayrollAttendance();

    return () => {
      active = false;
    };
  }, [selectedBranchId, fromDate, toDate]);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  async function saveSnapshot() {
    if (!selectedBranch) {
      setMessage("Choose a branch before saving a payroll snapshot.");
      return;
    }

    setSavingSnapshot(true);
    setMessage(null);

    try {
      const created = await tenantApi.tenantManagement.createAttendancePayrollSnapshot({
        branchId: selectedBranch.id,
        fromDate,
        toDate,
        note: snapshotNote.trim() || undefined
      });
      setSnapshots((current) => [created, ...current]);
      setSnapshotNote("");
      setMessage("Payroll attendance snapshot saved.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to save the payroll snapshot right now.");
      }
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function refreshPayroll(branchId: string) {
    const [nextBranches, nextSummary, nextCorrections, nextSnapshots, nextCreditRequests, nextPayrollBatches] =
      await Promise.all([
        tenantApi.tenantManagement.listBranches(),
        tenantApi.tenantManagement.listAttendancePayrollSummary({
          branchId,
          fromDate,
          toDate
        }),
        tenantApi.tenantManagement.listAttendanceCorrections({
          branchId,
          fromDate,
          toDate
        }),
        tenantApi.tenantManagement.listAttendancePayrollSnapshots({
          branchId,
          fromDate,
          toDate
        }),
        tenantApi.tenantManagement.listCreditRequests({
          branchId
        }),
        tenantApi.tenantManagement.listPayrollBatches({
          branchId,
          fromDate,
          toDate
        })
      ]);

    setBranches(nextBranches);
    setSummary(nextSummary);
    setCorrections(nextCorrections);
    setSnapshots(nextSnapshots);
    setCreditRequests(nextCreditRequests);
    setPayrollBatches(nextPayrollBatches);
  }

  async function updateCreditRequestStatus(
    creditRequestId: string,
    status: "approved" | "rejected",
    approvedAmount?: number
  ) {
    setUpdatingCreditRequestId(creditRequestId);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.updateCreditRequestStatus(creditRequestId, {
        status,
        approvedAmount
      });
      setMessage(`Credit request ${status}.`);
      if (selectedBranch) {
        await refreshPayroll(selectedBranch.id);
      }
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the credit request right now.");
      }
    } finally {
      setUpdatingCreditRequestId(null);
    }
  }

  async function createPayrollBatch() {
    if (!selectedBranch) {
      setMessage("Choose a branch before creating a payroll batch.");
      return;
    }

    setCreatingPayrollBatch(true);
    setMessage(null);

    try {
      const created = await tenantApi.tenantManagement.createPayrollBatch({
        branchId: selectedBranch.id,
        fromDate,
        toDate,
        hourlyRate: Number(hourlyRate || "0"),
        latePenaltyPerMinute: Number(latePenaltyPerMinute || "0"),
        includeCreditDeductions,
        note: snapshotNote.trim() || undefined
      });
      setPayrollBatches((current) => [created, ...current]);
      setMessage("Payroll batch created.");
      await refreshPayroll(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the payroll batch right now.");
      }
    } finally {
      setCreatingPayrollBatch(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Payroll attendance</Text>
          <Text style={styles.copy}>
            Review worked hours, late minutes, open sessions, and attendance corrections for a pay period before payroll is calculated.
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

              <TextInput
                onChangeText={setFromDate}
                placeholder="From date YYYY-MM-DD"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={fromDate}
              />
              <TextInput
                onChangeText={setToDate}
                placeholder="To date YYYY-MM-DD"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={toDate}
              />
              <TextInput
                onChangeText={setSnapshotNote}
                placeholder="Snapshot note"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={snapshotNote}
              />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setHourlyRate}
                placeholder="Hourly rate"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={hourlyRate}
              />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setLatePenaltyPerMinute}
                placeholder="Late penalty per minute"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={latePenaltyPerMinute}
              />
              <Pressable
                onPress={() => setIncludeCreditDeductions((current) => !current)}
                style={[
                  styles.branchChip,
                  includeCreditDeductions ? styles.branchChipActive : null
                ]}
              >
                <Text
                  style={[
                    styles.branchChipText,
                    includeCreditDeductions ? styles.branchChipTextActive : null
                  ]}
                >
                  {includeCreditDeductions ? "Credit deductions on" : "Credit deductions off"}
                </Text>
              </Pressable>
              <Pressable
                disabled={savingSnapshot}
                onPress={saveSnapshot}
                style={styles.primaryButton}
              >
                {savingSnapshot ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save payroll snapshot</Text>
                )}
              </Pressable>
              <Pressable
                disabled={creatingPayrollBatch}
                onPress={createPayrollBatch}
                style={styles.primaryButton}
              >
                {creatingPayrollBatch ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create payroll batch</Text>
                )}
              </Pressable>

              <Text style={styles.sectionTitle}>Attendance totals</Text>
              <View style={styles.listCard}>
                {summary.length ? (
                  summary.map((item) => (
                    <View key={item.employeeId} style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>
                        {item.employeeCode || "Employee"} | {item.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Worked: {item.totalWorkedHours} hours | Sessions: {item.totalSessions}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Completed: {item.completedSessions} | Open: {item.openSessions}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Late minutes: {item.totalLatenessMinutes} | Late sessions: {item.lateSessions}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Exceptions: {item.exceptionCount} | Flagged: {item.flaggedSessions} | Absent: {item.absentSessions}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No payroll attendance records found for this range.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Correction history</Text>
              <View style={styles.listCard}>
                {corrections.length ? (
                  corrections.map((item) => (
                    <View key={item.id} style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>
                        {item.employeeCode || "Employee"} | {item.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Corrected by: {item.actorEmail || "Unknown user"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Status: {item.fromStatus || "unknown"} {"->"} {item.toStatus || "unknown"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Lateness: {item.fromLatenessMinutes} {"->"} {item.toLatenessMinutes} min
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Exception: {item.fromExceptionFlag ? "flagged" : "clear"} {"->"} {item.toExceptionFlag ? "flagged" : "clear"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                      {item.note ? <Text style={styles.summaryMeta}>Note: {item.note}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No attendance corrections recorded for this range.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Saved snapshots</Text>
              <View style={styles.listCard}>
                {snapshots.length ? (
                  snapshots.map((item) => (
                    <View key={item.id} style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>
                        Period: {item.fromDate} {"->"} {item.toDate}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Saved by: {item.actorEmail || "Unknown user"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Employees: {item.employeeCount} | Worked: {item.totalWorkedHours} hours
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Late minutes: {item.totalLatenessMinutes} | Exceptions: {item.totalExceptions}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                      {item.note ? <Text style={styles.summaryMeta}>Note: {item.note}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No saved payroll snapshots for this range yet.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Credit requests</Text>
              <View style={styles.listCard}>
                {creditRequests.length ? (
                  creditRequests.map((item) => (
                    <View key={item.id} style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>
                        {item.employeeCode || "Employee"} | {item.employeeEmail || "No email"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Requested: {item.amount} | Outstanding: {item.outstandingAmount}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Status: {item.status} | Requested at: {new Date(item.requestedAt).toLocaleString()}
                      </Text>
                      {item.reason ? <Text style={styles.summaryMeta}>Reason: {item.reason}</Text> : null}
                      {item.status === "pending" ? (
                        <View style={styles.actionRow}>
                          <Pressable
                            disabled={updatingCreditRequestId === item.id}
                            onPress={() => void updateCreditRequestStatus(item.id, "approved", Number(item.amount))}
                            style={styles.primaryButton}
                          >
                            <Text style={styles.primaryButtonText}>Approve</Text>
                          </Pressable>
                          <Pressable
                            disabled={updatingCreditRequestId === item.id}
                            onPress={() => void updateCreditRequestStatus(item.id, "rejected")}
                            style={styles.secondaryAction}
                          >
                            <Text style={styles.secondaryActionText}>Reject</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No employee credit requests recorded for this branch yet.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Payroll batches</Text>
              <View style={styles.listCard}>
                {payrollBatches.length ? (
                  payrollBatches.map((batch) => (
                    <View key={batch.id} style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>
                        {batch.fromDate} {"->"} {batch.toDate} | {batch.status}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Gross: {batch.totals.grossAmount} | Deductions: {batch.totals.deductionsAmount}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Credit deductions: {batch.totals.creditDeductionAmount} | Net: {batch.totals.netAmount}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Hourly rate: {batch.hourlyRate} | Late penalty/min: {batch.latePenaltyPerMinute}
                      </Text>
                      {batch.items.map((item) => (
                        <Text key={item.id} style={styles.summaryMeta}>
                          {item.employeeCode || "Employee"}: worked {item.workedMinutes} min | net {item.netAmount}
                        </Text>
                      ))}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No payroll batches created for this range yet.</Text>
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
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    color: "#1E1E1E",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sectionTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
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
  listCard: {
    gap: 10
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 4
  },
  summaryTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  summaryMeta: {
    color: "#596467",
    fontSize: 13
  },
  secondaryAction: {
    backgroundColor: "#E6EFEF",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryActionText: {
    color: "#1D5C63",
    fontSize: 16,
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
