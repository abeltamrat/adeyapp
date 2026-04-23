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
import { useSession } from "../providers/session-provider";
import type { SupportTicketSummary } from "@adeyapp/types";

export default function OwnerSupportScreen() {
  const { session } = useSession();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<SupportTicketSummary["priority"]>("normal");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTickets() {
    setLoading(true);
    setMessage(null);

    try {
      const nextTickets = await tenantApi.tenantManagement.listSupportTickets();
      setTickets(nextTickets);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to load support tickets right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function submitTicket() {
    setSubmitting(true);
    setMessage(null);

    try {
      const created = await tenantApi.tenantManagement.createSupportTicket({
        branchId: session?.context?.branchId,
        subject,
        body,
        category: "operations",
        priority
      });
      setTickets((current) => [created, ...current]);
      setSubject("");
      setBody("");
      setPriority("normal");
      setMessage("Support ticket sent to the platform queue.");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to send the support ticket right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Support</Text>
          <Text style={styles.title}>Workspace support desk</Text>
          <Text style={styles.copy}>
            Send operational issues to the platform team and review the status of previous requests.
          </Text>

          <Text style={styles.sectionTitle}>Create support ticket</Text>
          <TextInput
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor="#8A8F90"
            style={styles.input}
            value={subject}
          />
          <TextInput
            multiline
            numberOfLines={5}
            onChangeText={setBody}
            placeholder="Describe the issue, the branch impact, and what you already tried."
            placeholderTextColor="#8A8F90"
            style={[styles.input, styles.textarea]}
            textAlignVertical="top"
            value={body}
          />
          <View style={styles.priorityRow}>
            {(["low", "normal", "high", "urgent"] as const).map((value) => {
              const active = priority === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPriority(value)}
                  style={[styles.priorityChip, active ? styles.priorityChipActive : null]}
                >
                  <Text style={[styles.priorityChipText, active ? styles.priorityChipTextActive : null]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            disabled={submitting || !subject.trim() || !body.trim()}
            onPress={() => void submitTicket()}
            style={[styles.primaryButton, submitting ? styles.buttonDisabled : null]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? "Sending..." : "Send support ticket"}
            </Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Recent tickets</Text>
          {loading ? <ActivityIndicator color="#1D5C63" /> : null}
          <View style={styles.list}>
            {tickets.length ? (
              tickets.map((ticket) => (
                <View key={ticket.id} style={styles.ticketCard}>
                  <Text style={styles.ticketTitle}>{ticket.subject}</Text>
                  <Text style={styles.ticketMeta}>
                    {ticket.priority} | {ticket.status}
                  </Text>
                  <Text style={styles.ticketMeta}>{ticket.createdAt}</Text>
                  <Text style={styles.ticketBody}>{ticket.body}</Text>
                  {ticket.resolutionNote ? (
                    <Text style={styles.ticketMeta}>Resolution: {ticket.resolutionNote}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No support tickets yet for this workspace.</Text>
            )}
          </View>
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
    fontSize: 26,
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
  input: {
    borderWidth: 1,
    borderColor: "#D7CEC0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#1E1E1E"
  },
  textarea: {
    minHeight: 120
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E7ECE8"
  },
  priorityChipActive: {
    backgroundColor: "#1D5C63"
  },
  priorityChipText: {
    color: "#1D5C63",
    fontWeight: "700"
  },
  priorityChipTextActive: {
    color: "#FFFFFF"
  },
  primaryButton: {
    backgroundColor: "#1D5C63",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  list: {
    gap: 10
  },
  ticketCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7CEC0",
    padding: 14,
    gap: 4
  },
  ticketTitle: {
    color: "#1E1E1E",
    fontWeight: "700"
  },
  ticketMeta: {
    color: "#596467",
    fontSize: 13
  },
  ticketBody: {
    color: "#374244"
  },
  emptyText: {
    color: "#7B8587"
  },
  message: {
    color: "#5A4A35",
    fontSize: 14
  }
});
