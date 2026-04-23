import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useSession } from "../providers/session-provider";

export default function OwnerScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Owner</Text>
        <Text style={styles.title}>Workspace operations shell</Text>
        <Text style={styles.copy}>
          Branches, rooms, services, products, employees, billing, and policies will start here.
        </Text>
        <Text style={styles.meta}>
          Active workspace: {session?.tenants[0]?.name ?? "No workspace selected yet"}
        </Text>
        {session && session.tenants.length > 1 ? (
          <Pressable onPress={() => router.push("/workspace/select")} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Switch workspace</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/notifications" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open inbox</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-shifts")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Plan shifts</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-attendance")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Review attendance</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-payroll")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Review payroll attendance</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-leave" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Manage leave desk</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-procurement" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Manage procurement</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-reports" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open operations reports</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-billing" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Review billing</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-support" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open support desk</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-policies")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Manage operations policies</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/reception")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open front desk bookings</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/reception-waitlist" as never)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open waitlist desk</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/owner-setup")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Setup branch rooms and services</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/workspace/create")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Create another workspace</Text>
        </Pressable>
        <Pressable onPress={signOut} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F3EC",
    padding: 24
  },
  card: {
    marginTop: 24,
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
    fontSize: 24,
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
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: "center"
  },
  ghostButtonText: {
    color: "#1D5C63",
    fontWeight: "700"
  }
});
