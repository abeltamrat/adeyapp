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
type OperationsReportSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.getOperationsReport>>;

function currentMonthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function OwnerReportsScreen() {
  const [branches, setBranches] = useState<BranchSetupSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [fromDate, setFromDate] = useState(currentMonthStart());
  const [toDate, setToDate] = useState(currentDate());
  const [report, setReport] = useState<OperationsReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setMessage(null);

      try {
        const nextBranches = await tenantApi.tenantManagement.listBranches();
        const branchId = selectedBranchId || "all";
        const nextReport = await tenantApi.tenantManagement.getOperationsReport({
          branchId: branchId === "all" ? undefined : branchId,
          fromDate,
          toDate
        });

        if (!active) {
          return;
        }

        setBranches(nextBranches);
        setSelectedBranchId(branchId);
        setReport(nextReport);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError) {
          setMessage(issue.details.message);
        } else {
          setMessage("Unable to load operations reports right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, [selectedBranchId, fromDate, toDate]);

  const selectedBranch =
    selectedBranchId === "all"
      ? null
      : branches.find((branch) => branch.id === selectedBranchId) ?? null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Operations reports</Text>
          <Text style={styles.copy}>
            Review revenue, booking flow, and inventory pressure for the selected reporting window.
          </Text>

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : (
            <>
              <View style={styles.branchList}>
                <Pressable
                  onPress={() => setSelectedBranchId("all")}
                  style={[
                    styles.branchChip,
                    selectedBranchId === "all" ? styles.branchChipActive : null
                  ]}
                >
                  <Text
                    style={[
                      styles.branchChipText,
                      selectedBranchId === "all" ? styles.branchChipTextActive : null
                    ]}
                  >
                    All branches
                  </Text>
                </Pressable>
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

              {report ? (
                <>
                  <Text style={styles.sectionTitle}>Totals</Text>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Completed revenue</Text>
                      <Text style={styles.summaryValue}>{report.totals.completedRevenue}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Completed appointments</Text>
                      <Text style={styles.summaryValue}>{report.totals.completedAppointments}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Created appointments</Text>
                      <Text style={styles.summaryValue}>{report.totals.createdAppointments}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Active customers</Text>
                      <Text style={styles.summaryValue}>{report.totals.activeCustomers}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Low stock items</Text>
                      <Text style={styles.summaryValue}>{report.totals.lowStockItems}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Out of stock items</Text>
                      <Text style={styles.summaryValue}>{report.totals.outOfStockItems}</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>Revenue by branch</Text>
                  <View style={styles.listCard}>
                    {report.revenueByBranch.length ? (
                      report.revenueByBranch.map((item) => (
                        <View key={item.branchId} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>{item.branchName}</Text>
                          <Text style={styles.itemMeta}>
                            Revenue: {item.completedRevenue} | Completed appointments: {item.completedAppointments}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No revenue records for this range yet.</Text>
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>Appointment volume by day</Text>
                  <View style={styles.listCard}>
                    {report.appointmentVolumeByDay.length ? (
                      report.appointmentVolumeByDay.map((item) => (
                        <View key={item.date} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>{item.date}</Text>
                          <Text style={styles.itemMeta}>
                            Created: {item.createdAppointments} | Completed: {item.completedAppointments}
                          </Text>
                          <Text style={styles.itemMeta}>
                            Canceled: {item.canceledAppointments} | No-show: {item.noShowAppointments}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No appointment volume records for this range yet.</Text>
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>Inventory by branch</Text>
                  <View style={styles.listCard}>
                    {report.inventoryByBranch.length ? (
                      report.inventoryByBranch.map((item) => (
                        <View key={item.branchId} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>{item.branchName}</Text>
                          <Text style={styles.itemMeta}>
                            Total items: {item.totalItems} | Low stock: {item.lowStockItems}
                          </Text>
                          <Text style={styles.itemMeta}>Out of stock: {item.outOfStockItems}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No inventory summary records for this branch yet.</Text>
                    )}
                  </View>
                </>
              ) : null}
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
  summaryGrid: {
    gap: 10
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 4
  },
  summaryLabel: {
    color: "#596467",
    fontSize: 13
  },
  summaryValue: {
    color: "#1E1E1E",
    fontSize: 24,
    fontWeight: "700"
  },
  listCard: {
    gap: 10
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
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
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
