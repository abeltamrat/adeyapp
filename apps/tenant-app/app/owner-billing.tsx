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

type TenantBillingSummary = Awaited<ReturnType<typeof tenantApi.tenantManagement.getBillingSummary>>;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function OwnerBillingScreen() {
  const [summary, setSummary] = useState<TenantBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBilling() {
    setLoading(true);
    setMessage(null);

    try {
      setSummary(await tenantApi.tenantManagement.getBillingSummary());
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to load billing right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Owner</Text>
          <Text style={styles.title}>Billing overview</Text>
          <Text style={styles.copy}>
            Review the current plan, subscription state, latest invoice, and recent payment activity for this workspace.
          </Text>
          <Pressable onPress={() => void loadBilling()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Refresh billing</Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator color="#1D5C63" />
          ) : summary ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                <Text style={styles.summaryMeta}>Workspace: {summary.tenantName}</Text>
                <Text style={styles.summaryMeta}>Tenant status: {summary.tenantStatus}</Text>
                <Text style={styles.summaryMeta}>Plan: {summary.currentPlanCode ?? "No plan assigned"}</Text>
                <Text style={styles.summaryMeta}>
                  Subscription status: {summary.subscriptionStatus ?? "Not active yet"}
                </Text>
                <Text style={styles.summaryMeta}>Renews at: {formatDateTime(summary.renewsAt)}</Text>
                <Text style={styles.summaryMeta}>Grace ends: {formatDateTime(summary.graceEndsAt)}</Text>
                <Text style={styles.summaryMeta}>Trial ends: {formatDateTime(summary.trialEndsAt)}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.sectionTitle}>Latest invoice</Text>
                {summary.latestInvoice ? (
                  <>
                    <Text style={styles.summaryMeta}>
                      {summary.latestInvoice.invoiceNumber} | {summary.latestInvoice.status}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      Amount: {summary.currency} {summary.latestInvoice.totalAmount}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      Issued: {formatDateTime(summary.latestInvoice.issuedAt)}
                    </Text>
                    <Text style={styles.summaryMeta}>Due: {formatDateTime(summary.latestInvoice.dueAt)}</Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No invoice has been issued yet.</Text>
                )}
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.sectionTitle}>Latest payment</Text>
                {summary.latestPayment ? (
                  <>
                    <Text style={styles.summaryMeta}>
                      {summary.latestPayment.paymentMethod} | {summary.latestPayment.status}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      Amount: {summary.currency} {summary.latestPayment.amount}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      Paid at: {formatDateTime(summary.latestPayment.paidAt)}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      Reference: {summary.latestPayment.providerReference ?? "No provider reference"}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No payment has been recorded yet.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Recent invoices</Text>
              <View style={styles.listCard}>
                {summary.recentInvoices.length ? (
                  summary.recentInvoices.map((invoice) => (
                    <View key={invoice.id} style={styles.listItem}>
                      <Text style={styles.itemTitle}>
                        {invoice.invoiceNumber} | {invoice.status}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        {summary.currency} {invoice.totalAmount}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Created: {formatDateTime(invoice.createdAt)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No invoices found for this workspace yet.</Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Recent payments</Text>
              <View style={styles.listCard}>
                {summary.recentPayments.length ? (
                  summary.recentPayments.map((payment) => (
                    <View key={payment.id} style={styles.listItem}>
                      <Text style={styles.itemTitle}>
                        {payment.paymentMethod} | {payment.status}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        {summary.currency} {payment.amount}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Invoice: {payment.invoiceNumber ?? "Unknown invoice"}
                      </Text>
                      <Text style={styles.summaryMeta}>
                        Recorded: {formatDateTime(payment.createdAt)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No payments found for this workspace yet.</Text>
                )}
              </View>
            </>
          ) : null}

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
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 4
  },
  listCard: {
    gap: 10
  },
  listItem: {
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
  summaryMeta: {
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
