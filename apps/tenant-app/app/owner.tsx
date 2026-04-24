import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "../providers/session-provider";

export default function OwnerScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();

  const activeWorkspace = session?.tenants[0]?.name ?? "No workspace selected";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Owner Portal</Text>
            <Text style={styles.title}>{activeWorkspace}</Text>
          </View>
          <Pressable onPress={() => router.push("/notifications" as never)} style={styles.iconButton}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </Pressable>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Revenue (Today)</Text>
            <Text style={styles.statValue}>-</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
            <Text style={styles.statLabel}>Staff Present</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
        </View>

        {/* Action Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Operations</Text>
          <View style={styles.actionGrid}>
            <DashboardAction
              icon="🛎️"
              label="Front Desk"
              onPress={() => router.push("/reception")}
            />
            <DashboardAction
              icon="⏳"
              label="Waitlist"
              onPress={() => router.push("/reception-waitlist" as never)}
            />
            <DashboardAction
              icon="📅"
              label="Shift Plan"
              onPress={() => router.push("/owner-shifts")}
            />
            <DashboardAction
              icon="✅"
              label="Attendance"
              onPress={() => router.push("/owner-attendance")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People & Finance</Text>
          <View style={styles.actionGrid}>
            <DashboardAction
              icon="💸"
              label="Payroll"
              onPress={() => router.push("/owner-payroll")}
            />
            <DashboardAction
              icon="🏖️"
              label="Leave"
              onPress={() => router.push("/owner-leave" as never)}
            />
            <DashboardAction
              icon="📦"
              label="Inventory"
              onPress={() => router.push("/owner-procurement" as never)}
            />
            <DashboardAction
              icon="💳"
              label="Billing"
              onPress={() => router.push("/owner-billing" as never)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          <View style={styles.actionGrid}>
            <DashboardAction
              icon="⚙️"
              label="Setup"
              onPress={() => router.push("/owner-setup")}
            />
            <DashboardAction
              icon="📜"
              label="Policies"
              onPress={() => router.push("/owner-policies")}
            />
            <DashboardAction
              icon="📊"
              label="Reports"
              onPress={() => router.push("/owner-reports" as never)}
            />
            <DashboardAction
              icon="🛠️"
              label="Support"
              onPress={() => router.push("/owner-support" as never)}
            />
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          {session && session.tenants.length > 1 && (
            <Pressable onPress={() => router.push("/workspace/select")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Switch Workspace</Text>
            </Pressable>
          )}
          <Pressable onPress={signOut} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionCard}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: "48%", // Roughly two columns
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  footer: {
    marginTop: 12,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontWeight: "600",
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostButtonText: {
    color: "#EF4444",
    fontWeight: "600",
  },
});

