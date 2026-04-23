import { ApiError } from "@adeyapp/api-client";
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

type BranchSetupSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listBranches>>[number];
type EmployeeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listEmployees>>[number];
type LeaveTypeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listLeaveTypes>>[number];
type LeaveBalanceSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listLeaveBalances>>[number];
type LeaveRequestSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listLeaveRequests>>[number];

export default function OwnerLeaveScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeSummary[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("");
  const [leaveTypeName, setLeaveTypeName] = useState("");
  const [leaveTypeCode, setLeaveTypeCode] = useState("");
  const [defaultBalanceDays, setDefaultBalanceDays] = useState("21");
  const [balanceDays, setBalanceDays] = useState("21");
  const [usedDays, setUsedDays] = useState("0");
  const [carriedOverDays, setCarriedOverDays] = useState("0");
  const [requestNote, setRequestNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingType, setSubmittingType] = useState(false);
  const [savingBalance, setSavingBalance] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? branches[0],
    [branches, selectedBranchId]
  );

  useEffect(() => {
    let active = true;

    async function loadLeaveDesk() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) {
          return;
        }

        const branchId = selectedBranchId || nextBranches[0]?.id || "";
        const [nextEmployees, nextLeaveTypes, nextLeaveBalances, nextLeaveRequests] = branchId
          ? await Promise.all([
              tenantApi.tenantManagement.listEmployees({ branchId }),
              tenantApi.tenantManagement.listLeaveTypes({ branchId }),
              tenantApi.tenantManagement.listLeaveBalances({ branchId }),
              tenantApi.tenantManagement.listLeaveRequests({ branchId })
            ])
          : [[], [], [], []];

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setEmployees(nextEmployees);
        setLeaveTypes(nextLeaveTypes);
        setLeaveBalances(nextLeaveBalances);
        setLeaveRequests(nextLeaveRequests);
        setSelectedBranchId(branchId);
        setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || "");
        setSelectedLeaveTypeId((current) => current || nextLeaveTypes[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load leave management data right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLeaveDesk();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  const selectedBalance = leaveBalances.find(
    (balance) => balance.employeeId === selectedEmployeeId && balance.leaveTypeId === selectedLeaveTypeId
  );

  useEffect(() => {
    if (selectedBalance) {
      setBalanceDays(selectedBalance.balanceDays);
      setUsedDays(selectedBalance.usedDays);
      setCarriedOverDays(selectedBalance.carriedOverDays);
    } else {
      setBalanceDays(defaultBalanceDays);
      setUsedDays("0");
      setCarriedOverDays("0");
    }
  }, [defaultBalanceDays, selectedBalance]);

  async function refreshLeaveDesk(branchId: string) {
    const [nextBranches, nextEmployees, nextLeaveTypes, nextLeaveBalances, nextLeaveRequests] = await Promise.all([
      tenantApi.tenantManagement.listBranches(),
      tenantApi.tenantManagement.listEmployees({ branchId }),
      tenantApi.tenantManagement.listLeaveTypes({ branchId }),
      tenantApi.tenantManagement.listLeaveBalances({ branchId }),
      tenantApi.tenantManagement.listLeaveRequests({ branchId })
    ]);

    setBranches(nextBranches);
    setEmployees(nextEmployees);
    setLeaveTypes(nextLeaveTypes);
    setLeaveBalances(nextLeaveBalances);
    setLeaveRequests(nextLeaveRequests);
    setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || "");
    setSelectedLeaveTypeId((current) => current || nextLeaveTypes[0]?.id || "");
  }

  async function submitLeaveType() {
    if (!selectedBranch || !leaveTypeName.trim() || !leaveTypeCode.trim()) {
      setMessage("Choose a branch and complete the leave type basics first.");
      return;
    }

    setSubmittingType(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createLeaveType({
        branchId: selectedBranch.id,
        name: leaveTypeName,
        code: leaveTypeCode,
        defaultBalanceDays: Number(defaultBalanceDays || "0")
      });
      setLeaveTypeName("");
      setLeaveTypeCode("");
      setMessage("Leave type created.");
      await refreshLeaveDesk(selectedBranch.id);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the leave type right now.");
      }
    } finally {
      setSubmittingType(false);
    }
  }

  async function saveBalance() {
    if (!selectedEmployeeId || !selectedLeaveTypeId) {
      setMessage("Choose an employee and leave type first.");
      return;
    }

    setSavingBalance(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.adjustLeaveBalance({
        employeeId: selectedEmployeeId,
        leaveTypeId: selectedLeaveTypeId,
        balanceDays: Number(balanceDays || "0"),
        usedDays: Number(usedDays || "0"),
        carriedOverDays: Number(carriedOverDays || "0")
      });
      setMessage("Leave balance updated.");
      if (selectedBranch) {
        await refreshLeaveDesk(selectedBranch.id);
      }
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the leave balance right now.");
      }
    } finally {
      setSavingBalance(false);
    }
  }

  async function updateRequestStatus(leaveRequestId: string, status: "approved" | "rejected") {
    setUpdatingRequestId(leaveRequestId);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.updateLeaveRequestStatus(leaveRequestId, {
        status,
        managerNote: requestNote.trim() || undefined
      });
      setRequestNote("");
      setMessage(`Leave request ${status}.`);
      if (selectedBranch) {
        await refreshLeaveDesk(selectedBranch.id);
      }
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to update the leave request right now.");
      }
    } finally {
      setUpdatingRequestId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Leave management</Text>
          <Text style={styles.copy}>
            Define leave types, set balances, and review branch-impact before approving staff time off.
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

              {selectedBranch ? (
                <>
                  <Text style={styles.sectionTitle}>Leave types</Text>
                  <View style={styles.listCard}>
                    {leaveTypes.length ? (
                      leaveTypes.map((leaveType) => (
                        <Pressable
                          key={leaveType.id}
                          onPress={() => setSelectedLeaveTypeId(leaveType.id)}
                          style={[
                            styles.selectorRow,
                            leaveType.id === selectedLeaveTypeId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              leaveType.id === selectedLeaveTypeId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {leaveType.name}
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              leaveType.id === selectedLeaveTypeId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {leaveType.code} | Default {leaveType.defaultBalanceDays} day(s)
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No leave types created for this branch yet.</Text>
                    )}
                  </View>
                  <TextInput
                    onChangeText={setLeaveTypeName}
                    placeholder="Leave type name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={leaveTypeName}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setLeaveTypeCode}
                    placeholder="Leave type code"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={leaveTypeCode}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setDefaultBalanceDays}
                    placeholder="Default balance days"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={defaultBalanceDays}
                  />
                  <Pressable disabled={submittingType} onPress={() => void submitLeaveType()} style={styles.primaryButton}>
                    {submittingType ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create leave type</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Leave balances</Text>
                  <View style={styles.selectorList}>
                    {employees.length ? (
                      employees.map((employee) => (
                        <Pressable
                          key={employee.id}
                          onPress={() => setSelectedEmployeeId(employee.id)}
                          style={[
                            styles.selectorRow,
                            employee.id === selectedEmployeeId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              employee.id === selectedEmployeeId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {employee.employeeCode}
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              employee.id === selectedEmployeeId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {employee.email}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No employees available for this branch yet.</Text>
                    )}
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setBalanceDays}
                    placeholder="Available balance days"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={balanceDays}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setUsedDays}
                    placeholder="Used days"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={usedDays}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setCarriedOverDays}
                    placeholder="Carried over days"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={carriedOverDays}
                  />
                  <Pressable disabled={savingBalance} onPress={() => void saveBalance()} style={styles.primaryButton}>
                    {savingBalance ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save leave balance</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Pending and recent requests</Text>
                  <TextInput
                    onChangeText={setRequestNote}
                    placeholder="Approval or rejection note"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={requestNote}
                  />
                  <View style={styles.listCard}>
                    {leaveRequests.length ? (
                      leaveRequests.map((request) => (
                        <View key={request.id} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>
                            {request.employeeCode || "Employee"} | {request.leaveTypeName}
                          </Text>
                          <Text style={styles.itemMeta}>
                            {request.startDate} {"->"} {request.endDate} | {request.dayCount} day(s) | {request.status}
                          </Text>
                          <Text style={styles.itemMeta}>
                            Branch impact: {request.branchImpact.employeesAlreadyOff} already off,{" "}
                            {request.branchImpact.availableEmployeesAfterApproval} available after approval
                          </Text>
                          {request.reason ? <Text style={styles.itemMeta}>Reason: {request.reason}</Text> : null}
                          {request.status === "pending" ? (
                            <View style={styles.actionRow}>
                              <Pressable
                                disabled={updatingRequestId === request.id}
                                onPress={() => void updateRequestStatus(request.id, "approved")}
                                style={styles.primaryAction}
                              >
                                <Text style={styles.primaryActionText}>Approve</Text>
                              </Pressable>
                              <Pressable
                                disabled={updatingRequestId === request.id}
                                onPress={() => void updateRequestStatus(request.id, "rejected")}
                                style={styles.dangerAction}
                              >
                                <Text style={styles.primaryActionText}>Reject</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No leave requests recorded for this branch yet.</Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No branch found for the active workspace.</Text>
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
  sectionTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1E1E"
  },
  listCard: {
    gap: 8
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
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    color: "#1E1E1E",
    paddingHorizontal: 14,
    paddingVertical: 12
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
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 12,
    gap: 4
  },
  itemTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  itemMeta: {
    color: "#596467",
    fontSize: 13
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  primaryAction: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  dangerAction: {
    backgroundColor: "#A33A2A",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  primaryActionText: {
    color: "#FFFFFF",
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
