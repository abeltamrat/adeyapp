"use client";

import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SuperadminTenantSummary, SupportTicketSummary } from "@adeyapp/types";
import {
  clearSuperadminToken,
  hasSuperadminToken,
  hydrateSuperadminApi,
  superadminApi
} from "../../lib/api";

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [tenants, setTenants] = useState<SuperadminTenantSummary[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSuperadminToken()) {
      router.replace("/login");
      return;
    }

    hydrateSuperadminApi();
    let active = true;

    async function loadSupportQueue() {
      setLoading(true);
      setMessage(null);

      try {
        const [tenantRows, ticketRows] = await Promise.all([
          superadminApi.superadmin.listTenants(),
          superadminApi.superadmin.listSupportTickets()
        ]);

        if (!active) {
          return;
        }

        setTenants(tenantRows);
        setTickets(ticketRows);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError && issue.details.status === 401) {
          clearSuperadminToken();
          router.replace("/login");
          return;
        }

        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load support tickets.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSupportQueue();

    return () => {
      active = false;
    };
  }, [router]);

  async function applyFilters() {
    setLoading(true);
    setMessage(null);

    try {
      const rows = await superadminApi.superadmin.listSupportTickets({
        tenantId: tenantId || undefined,
        status: status || undefined
      });
      setTickets(rows);
    } catch (issue) {
      if (issue instanceof ApiError && issue.details.status === 401) {
        clearSuperadminToken();
        router.replace("/login");
        return;
      }

      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to filter support tickets.");
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(ticket: SupportTicketSummary, nextStatus: SupportTicketSummary["status"]) {
    setBusyTicketId(ticket.id);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.updateSupportTicket(ticket.id, {
        status: nextStatus,
        resolutionNote:
          nextStatus === "resolved" || nextStatus === "closed"
            ? "Resolved from the phase 1 superadmin support queue."
            : undefined
      });

      setTickets((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (issue) {
      if (issue instanceof ApiError && issue.details.status === 401) {
        clearSuperadminToken();
        router.replace("/login");
        return;
      }

      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to update the support ticket.");
    } finally {
      setBusyTicketId(null);
    }
  }

  return (
    <section className="grid">
      <article className="panel">
        <p className="eyebrow">Support</p>
        <h1>Tenant support queue</h1>
        <p className="muted">
          Review owner and manager support requests, assign platform response state, and close the loop with the requester.
        </p>
        <div style={filterGridStyle}>
          <label style={fieldStyle}>
            <span>Tenant</span>
            <select onChange={(event) => setTenantId(event.target.value)} style={inputStyle} value={tenantId}>
              <option value="">All tenants</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} style={inputStyle} value={status}>
              <option value="">All statuses</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="waiting_on_customer">waiting_on_customer</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
          </label>
          <button disabled={loading} onClick={() => void applyFilters()} type="button">
            {loading ? "Loading..." : "Apply filters"}
          </button>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Queue</p>
        <h2>Open conversations</h2>
        {tickets.length ? (
          <div style={listStyle}>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={itemStyle}>
                <strong>{ticket.subject}</strong>
                <p className="muted">
                  {ticket.tenantName ?? "Workspace"} | {ticket.priority} | {ticket.status}
                </p>
                <p className="muted">
                  Requester: {ticket.requesterEmail ?? "unknown"}
                  {ticket.branchName ? ` | Branch: ${ticket.branchName}` : ""}
                </p>
                <p>{ticket.body}</p>
                {ticket.resolutionNote ? (
                  <p className="muted">Resolution: {ticket.resolutionNote}</p>
                ) : null}
                <div style={actionRowStyle}>
                  {ticket.status === "open" ? (
                    <button
                      disabled={busyTicketId === ticket.id}
                      onClick={() => void updateTicket(ticket, "in_progress")}
                      type="button"
                    >
                      Start work
                    </button>
                  ) : null}
                  {ticket.status !== "waiting_on_customer" ? (
                    <button
                      disabled={busyTicketId === ticket.id}
                      onClick={() => void updateTicket(ticket, "waiting_on_customer")}
                      type="button"
                    >
                      Waiting on customer
                    </button>
                  ) : null}
                  {ticket.status !== "resolved" ? (
                    <button
                      disabled={busyTicketId === ticket.id}
                      onClick={() => void updateTicket(ticket, "resolved")}
                      type="button"
                    >
                      Resolve
                    </button>
                  ) : null}
                  {ticket.status !== "closed" ? (
                    <button
                      disabled={busyTicketId === ticket.id}
                      onClick={() => void updateTicket(ticket, "closed")}
                      type="button"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{loading ? "Loading support queue..." : "No support tickets matched the current filters."}</p>
        )}
      </article>
      {message ? (
        <article className="panel">
          <p className="muted">{message}</p>
        </article>
      ) : null}
    </section>
  );
}

const filterGridStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "12px"
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "6px"
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  padding: "10px 12px",
  font: "inherit",
  background: "var(--surface)",
  color: "var(--ink)"
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "12px"
};

const itemStyle: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "16px",
  padding: "14px"
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "10px"
};
