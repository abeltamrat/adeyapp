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
type EmployeeSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listEmployees>>[number];
type ShiftTemplateSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.listShiftTemplates>>[number];
type ShiftAssignmentSummary = Awaited<
  ReturnType<typeof tenantApi.tenantManagement.listShiftAssignments>
>[number];

function defaultShiftDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function OwnerShiftsScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplateSummary[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignmentSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [shiftDate, setShiftDate] = useState(defaultShiftDate());
  const [templateName, setTemplateName] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateStart, setTemplateStart] = useState("08:00");
  const [templateEnd, setTemplateEnd] = useState("16:00");
  const [graceMinutes, setGraceMinutes] = useState("10");
  const [loading, setLoading] = useState(true);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadShiftPlanner() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        if (!active) {
          return;
        }

        const branchId = selectedBranchId || nextBranches[0]?.id || "";
        const [nextEmployees, nextTemplates, nextAssignments] = branchId
          ? await Promise.all([
              tenantApi.tenantManagement.listEmployees({ branchId }),
              tenantApi.tenantManagement.listShiftTemplates({ branchId }),
              tenantApi.tenantManagement.listShiftAssignments({ branchId, date: shiftDate })
            ])
          : [[], [], []];

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setSelectedBranchId(branchId);
        setEmployees(nextEmployees);
        setTemplates(nextTemplates);
        setAssignments(nextAssignments);
        setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || "");
        setSelectedTemplateId((current) => current || nextTemplates[0]?.id || "");
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load shift planning data right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadShiftPlanner();

    return () => {
      active = false;
    };
  }, [selectedBranchId, shiftDate]);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  async function refreshPlanner() {
    const nextBranches = await tenantApi.tenantManagement.listBranches();
    const branchId = selectedBranchId || nextBranches[0]?.id || "";
    const [nextEmployees, nextTemplates, nextAssignments] = branchId
      ? await Promise.all([
          tenantApi.tenantManagement.listEmployees({ branchId }),
          tenantApi.tenantManagement.listShiftTemplates({ branchId }),
          tenantApi.tenantManagement.listShiftAssignments({ branchId, date: shiftDate })
        ])
      : [[], [], []];

    setBranches(nextBranches);
    setEmployees(nextEmployees);
    setTemplates(nextTemplates);
    setAssignments(nextAssignments);
    setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || "");
    setSelectedTemplateId((current) => current || nextTemplates[0]?.id || "");
  }

  async function submitTemplate() {
    if (!selectedBranch || !templateName.trim() || !templateCode.trim()) {
      setMessage("Choose a branch and complete the shift template basics first.");
      return;
    }

    setSubmittingTemplate(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createShiftTemplate({
        branchId: selectedBranch.id,
        name: templateName,
        code: templateCode,
        startTime: templateStart,
        endTime: templateEnd,
        gracePeriodMinutes: Number(graceMinutes || "0")
      });
      setTemplateName("");
      setTemplateCode("");
      setTemplateStart("08:00");
      setTemplateEnd("16:00");
      setGraceMinutes("10");
      setMessage("Shift template created.");
      await refreshPlanner();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to create the shift template right now.");
      }
    } finally {
      setSubmittingTemplate(false);
    }
  }

  async function submitAssignment() {
    if (!selectedBranch || !selectedEmployeeId || !selectedTemplateId || !shiftDate.trim()) {
      setMessage("Choose a branch, employee, template, and shift date first.");
      return;
    }

    setSubmittingAssignment(true);
    setMessage(null);

    try {
      await tenantApi.tenantManagement.createShiftAssignment({
        branchId: selectedBranch.id,
        employeeId: selectedEmployeeId,
        shiftTemplateId: selectedTemplateId,
        shiftDate
      });
      setMessage("Shift assigned successfully.");
      await refreshPlanner();
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to assign the shift right now.");
      }
    } finally {
      setSubmittingAssignment(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Shift planner</Text>
          <Text style={styles.copy}>
            Create reusable shift templates, assign them by date, and feed attendance lateness from the same branch setup.
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
                  <Text style={styles.sectionTitle}>Shift templates</Text>
                  <View style={styles.listCard}>
                    {templates.length ? (
                      templates.map((template) => (
                        <Pressable
                          key={template.id}
                          onPress={() => setSelectedTemplateId(template.id)}
                          style={[
                            styles.selectorRow,
                            template.id === selectedTemplateId ? styles.selectorRowActive : null
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorTitle,
                              template.id === selectedTemplateId ? styles.selectorTitleActive : null
                            ]}
                          >
                            {template.name} ({template.code})
                          </Text>
                          <Text
                            style={[
                              styles.selectorMeta,
                              template.id === selectedTemplateId ? styles.selectorMetaActive : null
                            ]}
                          >
                            {template.startTime} - {template.endTime} | Grace {template.gracePeriodMinutes} min
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No shift templates created yet.</Text>
                    )}
                  </View>

                  <TextInput
                    onChangeText={setTemplateName}
                    placeholder="Shift template name"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={templateName}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setTemplateCode}
                    placeholder="Template code"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={templateCode}
                  />
                  <TextInput
                    onChangeText={setTemplateStart}
                    placeholder="Start time HH:MM"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={templateStart}
                  />
                  <TextInput
                    onChangeText={setTemplateEnd}
                    placeholder="End time HH:MM"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={templateEnd}
                  />
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={setGraceMinutes}
                    placeholder="Grace minutes"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={graceMinutes}
                  />
                  <Pressable
                    disabled={submittingTemplate}
                    onPress={submitTemplate}
                    style={styles.primaryButton}
                  >
                    {submittingTemplate ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create shift template</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Assign shifts</Text>
                  <TextInput
                    onChangeText={setShiftDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#8A918F"
                    style={styles.input}
                    value={shiftDate}
                  />
                  <View style={styles.listCard}>
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
                      <Text style={styles.emptyText}>No active employees found for this branch.</Text>
                    )}
                  </View>
                  <Pressable
                    disabled={submittingAssignment}
                    onPress={submitAssignment}
                    style={styles.primaryButton}
                  >
                    {submittingAssignment ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Assign selected shift</Text>
                    )}
                  </Pressable>

                  <Text style={styles.sectionTitle}>Assignments on {shiftDate}</Text>
                  <View style={styles.listCard}>
                    {assignments.length ? (
                      assignments.map((assignment) => (
                        <View key={assignment.id} style={styles.assignmentCard}>
                          <Text style={styles.assignmentTitle}>
                            {assignment.employeeCode || "Employee"} | {assignment.shiftTemplateName}
                          </Text>
                          <Text style={styles.assignmentMeta}>
                            {assignment.startAt} {"->"} {assignment.endAt}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No shifts assigned for this date yet.</Text>
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
  assignmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 12,
    gap: 4
  },
  assignmentTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  assignmentMeta: {
    color: "#596467",
    fontSize: 13
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
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
