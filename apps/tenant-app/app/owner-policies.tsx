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

export default function OwnerPoliciesScreen() {
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [savingAcknowledgement, setSavingAcknowledgement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [policies, setPolicies] = useState({
    managerCanCorrectAttendance: true,
    managerCanSuspendStaff: true,
    bookingCancellationWindowHours: 4,
    bookingLeadTimeMinutes: 120,
    cleanupBufferMinutes: 0,
    sensitiveInventoryAdjustments: false,
    sensitiveAttendanceCorrections: false,
    sensitiveAppointmentStatusChanges: false,
    sensitiveEmployeeStatusChanges: false
  });
  const [acknowledgement, setAcknowledgement] = useState({
    enabled: false,
    version: "v1",
    title: "Workspace handbook acknowledgement",
    body: "Please review and acknowledge the latest workspace operating rules.",
    requiredRoles: ["manager", "receptionist", "employee"] as Array<"manager" | "receptionist" | "employee">
  });
  const [branchPolicies, setBranchPolicies] = useState({
    branchId: "",
    bookingCancellationWindowHours: 4,
    bookingLeadTimeMinutes: 120,
    cleanupBufferMinutes: 0,
    useWorkspaceCancellationWindow: true,
    useWorkspaceLeadTime: true,
    useWorkspaceCleanupBuffer: true
  });

  useEffect(() => {
    let active = true;

    async function loadPolicies() {
      setLoading(true);
      setMessage(null);

      try {
        const [nextPolicies, nextBranches, nextAcknowledgement] = await Promise.all([
          tenantApi.tenantManagement.getOperationPolicies(),
          tenantApi.tenantManagement.listBranches(),
          tenantApi.tenantManagement.getPolicyAcknowledgement()
        ]);

        if (!active) {
          return;
        }

        const firstBranchId = nextBranches[0]?.id ?? "";
        setPolicies(nextPolicies);
        setBranches(nextBranches);
        setSelectedBranchId(firstBranchId);
        setAcknowledgement({
          enabled: nextAcknowledgement.enabled,
          version: nextAcknowledgement.version,
          title: nextAcknowledgement.title,
          body: nextAcknowledgement.body,
          requiredRoles: nextAcknowledgement.requiredRoles
        });

        if (firstBranchId) {
          const nextBranchPolicies = await tenantApi.tenantManagement.getBranchBookingPolicies(firstBranchId);
          if (active) {
            setBranchPolicies(nextBranchPolicies);
          }
        }
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load workspace policies right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPolicies();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBranchPolicies() {
      if (!selectedBranchId) {
        return;
      }

      try {
        const nextBranchPolicies = await tenantApi.tenantManagement.getBranchBookingPolicies(selectedBranchId);
        if (active) {
          setBranchPolicies(nextBranchPolicies);
        }
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load branch overrides right now.");
        }
      }
    }

    void loadBranchPolicies();

    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  async function saveWorkspacePolicies() {
    setSavingWorkspace(true);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateOperationPolicies({
        ...policies,
        bookingCancellationWindowHours: Number.parseInt(String(policies.bookingCancellationWindowHours), 10) || 0,
        bookingLeadTimeMinutes: Number.parseInt(String(policies.bookingLeadTimeMinutes), 10) || 0,
        cleanupBufferMinutes: Number.parseInt(String(policies.cleanupBufferMinutes), 10) || 0
      });
      setPolicies(updated);
      setMessage("Workspace booking policies updated.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to save workspace policies right now.");
      }
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function saveBranchPolicies() {
    if (!selectedBranchId) {
      setMessage("Choose a branch before saving branch overrides.");
      return;
    }

    setSavingBranch(true);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updateBranchBookingPolicies({
        ...branchPolicies,
        branchId: selectedBranchId,
        bookingCancellationWindowHours:
          Number.parseInt(String(branchPolicies.bookingCancellationWindowHours), 10) || 0,
        bookingLeadTimeMinutes: Number.parseInt(String(branchPolicies.bookingLeadTimeMinutes), 10) || 0,
        cleanupBufferMinutes: Number.parseInt(String(branchPolicies.cleanupBufferMinutes), 10) || 0
      });
      setBranchPolicies(updated);
      setMessage("Branch booking overrides updated.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to save branch policies right now.");
      }
    } finally {
      setSavingBranch(false);
    }
  }

  async function saveAcknowledgementPolicy() {
    setSavingAcknowledgement(true);
    setMessage(null);

    try {
      const updated = await tenantApi.tenantManagement.updatePolicyAcknowledgement({
        enabled: acknowledgement.enabled,
        version: acknowledgement.version.trim() || "v1",
        title: acknowledgement.title.trim() || "Workspace handbook acknowledgement",
        body: acknowledgement.body.trim(),
        requiredRoles: acknowledgement.requiredRoles
      });
      setAcknowledgement({
        enabled: updated.enabled,
        version: updated.version,
        title: updated.title,
        body: updated.body,
        requiredRoles: updated.requiredRoles
      });
      setMessage("Acknowledgement policy updated.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to save the acknowledgement policy right now.");
      }
    } finally {
      setSavingAcknowledgement(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Operations policies</Text>
          <Text style={styles.copy}>
            Control booking windows at workspace level, then override them per branch where needed.
          </Text>

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : (
            <>
              <Text style={styles.sectionTitle}>Workspace rules</Text>
              <Pressable
                onPress={() =>
                  setPolicies((current) => ({
                    ...current,
                    managerCanCorrectAttendance: !current.managerCanCorrectAttendance
                  }))
                }
                style={[
                  styles.policyCard,
                  policies.managerCanCorrectAttendance ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    policies.managerCanCorrectAttendance ? styles.policyTitleActive : null
                  ]}
                >
                  Manager attendance corrections
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    policies.managerCanCorrectAttendance ? styles.policyMetaActive : null
                  ]}
                >
                  {policies.managerCanCorrectAttendance ? "Enabled" : "Disabled"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setPolicies((current) => ({
                    ...current,
                    managerCanSuspendStaff: !current.managerCanSuspendStaff
                  }))
                }
                style={[
                  styles.policyCard,
                  policies.managerCanSuspendStaff ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    policies.managerCanSuspendStaff ? styles.policyTitleActive : null
                  ]}
                >
                  Manager staff suspension
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    policies.managerCanSuspendStaff ? styles.policyMetaActive : null
                  ]}
                >
                  {policies.managerCanSuspendStaff ? "Enabled" : "Disabled"}
                </Text>
              </Pressable>

              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setPolicies((current) => ({
                    ...current,
                    bookingCancellationWindowHours: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Cancellation window hours"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={String(policies.bookingCancellationWindowHours)}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setPolicies((current) => ({
                    ...current,
                    bookingLeadTimeMinutes: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Lead time minutes"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={String(policies.bookingLeadTimeMinutes)}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setPolicies((current) => ({
                    ...current,
                    cleanupBufferMinutes: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Default cleanup buffer minutes"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={String(policies.cleanupBufferMinutes)}
              />

              {[
                {
                  key: "sensitiveInventoryAdjustments" as const,
                  title: "Sensitive inventory adjustments",
                  meta: "Create an extra audit record whenever stock counts are changed manually."
                },
                {
                  key: "sensitiveAttendanceCorrections" as const,
                  title: "Sensitive attendance corrections",
                  meta: "Escalate attendance edits into a dedicated policy-triggered audit event."
                },
                {
                  key: "sensitiveAppointmentStatusChanges" as const,
                  title: "Sensitive appointment status changes",
                  meta: "Track front-desk status changes as specially flagged operational events."
                },
                {
                  key: "sensitiveEmployeeStatusChanges" as const,
                  title: "Sensitive employee status changes",
                  meta: "Escalate suspension, reactivation, and termination into policy-triggered audit entries."
                }
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() =>
                    setPolicies((current) => ({
                      ...current,
                      [item.key]: !current[item.key]
                    }))
                  }
                  style={[
                    styles.policyCard,
                    policies[item.key] ? styles.policyCardActive : null
                  ]}
                >
                  <Text
                    style={[
                      styles.policyTitle,
                      policies[item.key] ? styles.policyTitleActive : null
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.policyMeta,
                      policies[item.key] ? styles.policyMetaActive : null
                    ]}
                  >
                    {item.meta}
                  </Text>
                </Pressable>
              ))}

              <Pressable disabled={savingWorkspace} onPress={saveWorkspacePolicies} style={styles.primaryButton}>
                {savingWorkspace ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save workspace policies</Text>
                )}
              </Pressable>

              <Text style={styles.sectionTitle}>Branch overrides</Text>
              <View style={styles.branchList}>
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => setSelectedBranchId(branch.id)}
                    style={[
                      styles.branchChip,
                      branch.id === selectedBranchId ? styles.branchChipActive : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.branchChipText,
                        branch.id === selectedBranchId ? styles.branchChipTextActive : null
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() =>
                  setBranchPolicies((current) => ({
                    ...current,
                    useWorkspaceCancellationWindow: !current.useWorkspaceCancellationWindow
                  }))
                }
                style={[
                  styles.policyCard,
                  !branchPolicies.useWorkspaceCancellationWindow ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    !branchPolicies.useWorkspaceCancellationWindow ? styles.policyTitleActive : null
                  ]}
                >
                  Branch cancellation window
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    !branchPolicies.useWorkspaceCancellationWindow ? styles.policyMetaActive : null
                  ]}
                >
                  {branchPolicies.useWorkspaceCancellationWindow ? "Using workspace default" : "Using branch override"}
                </Text>
              </Pressable>
              <TextInput
                editable={!branchPolicies.useWorkspaceCancellationWindow}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setBranchPolicies((current) => ({
                    ...current,
                    bookingCancellationWindowHours: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Branch cancellation window hours"
                placeholderTextColor="#8A918F"
                style={[
                  styles.input,
                  branchPolicies.useWorkspaceCancellationWindow ? styles.inputDisabled : null
                ]}
                value={String(branchPolicies.bookingCancellationWindowHours)}
              />

              <Pressable
                onPress={() =>
                  setBranchPolicies((current) => ({
                    ...current,
                    useWorkspaceLeadTime: !current.useWorkspaceLeadTime
                  }))
                }
                style={[
                  styles.policyCard,
                  !branchPolicies.useWorkspaceLeadTime ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    !branchPolicies.useWorkspaceLeadTime ? styles.policyTitleActive : null
                  ]}
                >
                  Branch lead time
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    !branchPolicies.useWorkspaceLeadTime ? styles.policyMetaActive : null
                  ]}
                >
                  {branchPolicies.useWorkspaceLeadTime ? "Using workspace default" : "Using branch override"}
                </Text>
              </Pressable>
              <TextInput
                editable={!branchPolicies.useWorkspaceLeadTime}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setBranchPolicies((current) => ({
                    ...current,
                    bookingLeadTimeMinutes: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Branch lead time minutes"
                placeholderTextColor="#8A918F"
                style={[
                  styles.input,
                  branchPolicies.useWorkspaceLeadTime ? styles.inputDisabled : null
                ]}
                value={String(branchPolicies.bookingLeadTimeMinutes)}
              />

              <Pressable
                onPress={() =>
                  setBranchPolicies((current) => ({
                    ...current,
                    useWorkspaceCleanupBuffer: !current.useWorkspaceCleanupBuffer
                  }))
                }
                style={[
                  styles.policyCard,
                  !branchPolicies.useWorkspaceCleanupBuffer ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    !branchPolicies.useWorkspaceCleanupBuffer ? styles.policyTitleActive : null
                  ]}
                >
                  Branch cleanup buffer
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    !branchPolicies.useWorkspaceCleanupBuffer ? styles.policyMetaActive : null
                  ]}
                >
                  {branchPolicies.useWorkspaceCleanupBuffer ? "Using workspace default" : "Using branch override"}
                </Text>
              </Pressable>
              <TextInput
                editable={!branchPolicies.useWorkspaceCleanupBuffer}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setBranchPolicies((current) => ({
                    ...current,
                    cleanupBufferMinutes: Number.parseInt(value || "0", 10) || 0
                  }))
                }
                placeholder="Branch cleanup buffer minutes"
                placeholderTextColor="#8A918F"
                style={[
                  styles.input,
                  branchPolicies.useWorkspaceCleanupBuffer ? styles.inputDisabled : null
                ]}
                value={String(branchPolicies.cleanupBufferMinutes)}
              />

              <Pressable disabled={savingBranch} onPress={saveBranchPolicies} style={styles.primaryButton}>
                {savingBranch ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save branch overrides</Text>
                )}
              </Pressable>

              <Text style={styles.sectionTitle}>Policy acknowledgement</Text>
              <Pressable
                onPress={() =>
                  setAcknowledgement((current) => ({
                    ...current,
                    enabled: !current.enabled
                  }))
                }
                style={[
                  styles.policyCard,
                  acknowledgement.enabled ? styles.policyCardActive : null
                ]}
              >
                <Text
                  style={[
                    styles.policyTitle,
                    acknowledgement.enabled ? styles.policyTitleActive : null
                  ]}
                >
                  Staff acknowledgement requirement
                </Text>
                <Text
                  style={[
                    styles.policyMeta,
                    acknowledgement.enabled ? styles.policyMetaActive : null
                  ]}
                >
                  {acknowledgement.enabled
                    ? "Required before staff can continue branch operations."
                    : "Disabled for staff logins."}
                </Text>
              </Pressable>
              <TextInput
                onChangeText={(value) =>
                  setAcknowledgement((current) => ({
                    ...current,
                    version: value
                  }))
                }
                placeholder="Policy version"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={acknowledgement.version}
              />
              <TextInput
                onChangeText={(value) =>
                  setAcknowledgement((current) => ({
                    ...current,
                    title: value
                  }))
                }
                placeholder="Acknowledgement title"
                placeholderTextColor="#8A918F"
                style={styles.input}
                value={acknowledgement.title}
              />
              <TextInput
                multiline
                onChangeText={(value) =>
                  setAcknowledgement((current) => ({
                    ...current,
                    body: value
                  }))
                }
                placeholder="Acknowledgement body"
                placeholderTextColor="#8A918F"
                style={[styles.input, styles.textArea]}
                value={acknowledgement.body}
              />
              <View style={styles.branchList}>
                {(["manager", "receptionist", "employee"] as const).map((role) => {
                  const selected = acknowledgement.requiredRoles.includes(role);
                  return (
                    <Pressable
                      key={role}
                      onPress={() =>
                        setAcknowledgement((current) => ({
                          ...current,
                          requiredRoles: current.requiredRoles.includes(role)
                            ? current.requiredRoles.filter((entry) => entry !== role)
                            : [...current.requiredRoles, role]
                        }))
                      }
                      style={[
                        styles.branchChip,
                        selected ? styles.branchChipActive : null
                      ]}
                    >
                      <Text
                        style={[
                          styles.branchChipText,
                          selected ? styles.branchChipTextActive : null
                        ]}
                      >
                        {role}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                disabled={savingAcknowledgement}
                onPress={saveAcknowledgementPolicy}
                style={styles.primaryButton}
              >
                {savingAcknowledgement ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save acknowledgement policy</Text>
                )}
              </Pressable>
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
  sectionTitle: {
    marginTop: 8,
    color: "#1E1E1E",
    fontSize: 16,
    fontWeight: "700"
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
  policyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 16,
    gap: 4
  },
  policyCardActive: {
    backgroundColor: "#1D5C63",
    borderColor: "#1D5C63"
  },
  policyTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  policyTitleActive: {
    color: "#FFFFFF"
  },
  policyMeta: {
    color: "#596467",
    fontSize: 13
  },
  policyMetaActive: {
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
  inputDisabled: {
    opacity: 0.5
  },
  textArea: {
    minHeight: 120,
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
    fontWeight: "700",
    fontSize: 16
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
