"use client";

import { ApiError } from "@adeyapp/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type {
  SuperadminDashboardSummary,
  SuperadminTenantSummary,
  SuperadminTenantUsageSummary
} from "@adeyapp/types";
import {
  clearSuperadminToken,
  hasSuperadminToken,
  hydrateSuperadminApi,
  superadminApi
} from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SuperadminDashboardSummary | null>(null);
  const [tenants, setTenants] = useState<SuperadminTenantSummary[]>([]);
  const [usage, setUsage] = useState<SuperadminTenantUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [maintenanceTitle, setMaintenanceTitle] = useState("Scheduled maintenance");
  const [maintenanceBody, setMaintenanceBody] = useState(
    "The platform will enter a short maintenance window tonight. Please finish any open front-desk work before the window starts."
  );
  const [daysAhead, setDaysAhead] = useState("3");
  const [sendingMaintenance, setSendingMaintenance] = useState(false);
  const [runningTrialScan, setRunningTrialScan] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSuperadminToken()) {
      router.replace("/login");
      return;
    }

    hydrateSuperadminApi();
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setMessage(null);

      try {
        const [dashboard, allTenants, usageSummary] = await Promise.all([
          superadminApi.superadmin.getDashboard(),
          superadminApi.superadmin.listTenants(),
          superadminApi.superadmin.listUsage()
        ]);
        if (!active) {
          return;
        }

        setSummary(dashboard);
        setTenants(allTenants.slice(0, 5));
        setUsage(usageSummary.slice(0, 5));
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError && issue.details.status === 401) {
          clearSuperadminToken();
          router.replace("/login");
          return;
        }

        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load dashboard data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  async function sendMaintenanceAnnouncement() {
    setSendingMaintenance(true);
    setActionMessage(null);

    try {
      const result = await superadminApi.superadmin.sendMaintenanceAnnouncement({
        title: maintenanceTitle.trim(),
        body: maintenanceBody.trim()
      });
      setActionMessage(
        `Maintenance announcement delivered to ${result.deliveredCount} workspace recipients.`
      );
    } catch (issue) {
      if (issue instanceof ApiError && issue.details.status === 401) {
        clearSuperadminToken();
        router.replace("/login");
        return;
      }

      setActionMessage(
        issue instanceof ApiError
          ? issue.details.message
          : "Unable to send the maintenance announcement."
      );
    } finally {
      setSendingMaintenance(false);
    }
  }

  async function runTrialEndingScan() {
    setRunningTrialScan(true);
    setActionMessage(null);

    try {
      const parsedDaysAhead = Number.parseInt(daysAhead, 10);
      const result = await superadminApi.superadmin.runTrialEndingScan({
        daysAhead: Number.isFinite(parsedDaysAhead) ? parsedDaysAhead : 3
      });
      setActionMessage(
        `Trial-ending reminders delivered to ${result.deliveredCount} recipients for the next ${result.daysAhead} days.`
      );
    } catch (issue) {
      if (issue instanceof ApiError && issue.details.status === 401) {
        clearSuperadminToken();
        router.replace("/login");
        return;
      }

      setActionMessage(
        issue instanceof ApiError ? issue.details.message : "Unable to run the trial-ending scan."
      );
    } finally {
      setRunningTrialScan(false);
    }
  }

  return (
    <section className="grid">
      <article className="panel">
        <p className="eyebrow">Tenants</p>
        <h1>Platform overview</h1>
        {loading ? (
          <p className="muted">Loading platform counts...</p>
        ) : summary ? (
          <div className="grid">
            <p>Total tenants: {summary.totalTenants}</p>
            <p>Active tenants: {summary.activeTenants}</p>
            <p>Trial tenants: {summary.trialTenants}</p>
            <p>Suspended tenants: {summary.suspendedTenants}</p>
            <p>Past-due subscriptions: {summary.pastDueSubscriptions}</p>
            <p>Open support tickets: {summary.openSupportTickets}</p>
          </div>
        ) : (
          <p className="muted">No dashboard data yet.</p>
        )}
      </article>
      <article className="panel">
        <p className="eyebrow">Recent tenants</p>
        <h2>Newest workspace accounts</h2>
        {tenants.length ? (
          <div className="grid">
            {tenants.map((tenant) => (
              <div key={tenant.id}>
                <strong>{tenant.name}</strong>
                <p className="muted">
                  {tenant.slug} | {tenant.status} | {tenant.currentPlanCode ?? "no plan"}
                </p>
                <Link href={`/tenants/${tenant.id}`}>Open tenant</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No tenant records to show yet.</p>
        )}
      </article>
      <article className="panel">
        <p className="eyebrow">Usage</p>
        <h2>Tenant activity watchlist</h2>
        {usage.length ? (
          <div className="grid">
            {usage.map((tenant) => (
              <div key={tenant.tenantId}>
                <strong>{tenant.tenantName}</strong>
                <p className="muted">
                  Appointments 30d: {tenant.appointmentCount30d} | Completed:{" "}
                  {tenant.completedAppointmentCount30d}
                </p>
                <p className="muted">
                  Staff: {tenant.activeEmployeeCount} | Customers: {tenant.customerCount}
                </p>
                <p className="muted">
                  Unread inbox: {tenant.unreadNotificationCount} | Open support:{" "}
                  {tenant.openSupportTicketCount}
                </p>
                <Link href={`/tenants/${tenant.tenantId}`}>Open tenant</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No tenant usage data is available yet.</p>
        )}
      </article>
      <article className="panel">
        <p className="eyebrow">Notifications</p>
        <h2>Platform broadcasts</h2>
        <p className="muted">
          Send a maintenance announcement to active tenants and trigger trial-ending reminders.
        </p>
        <div style={stackStyle}>
          <label style={fieldStyle}>
            <span>Announcement title</span>
            <input
              onChange={(event) => setMaintenanceTitle(event.target.value)}
              style={inputStyle}
              value={maintenanceTitle}
            />
          </label>
          <label style={fieldStyle}>
            <span>Announcement body</span>
            <textarea
              onChange={(event) => setMaintenanceBody(event.target.value)}
              rows={4}
              style={inputStyle}
              value={maintenanceBody}
            />
          </label>
          <button
            disabled={sendingMaintenance || !maintenanceTitle.trim() || !maintenanceBody.trim()}
            onClick={() => void sendMaintenanceAnnouncement()}
            type="button"
          >
            {sendingMaintenance ? "Sending..." : "Send maintenance notice"}
          </button>
          <label style={fieldStyle}>
            <span>Trial reminder window in days</span>
            <input
              inputMode="numeric"
              onChange={(event) => setDaysAhead(event.target.value)}
              style={inputStyle}
              value={daysAhead}
            />
          </label>
          <button
            disabled={runningTrialScan}
            onClick={() => void runTrialEndingScan()}
            type="button"
          >
            {runningTrialScan ? "Running..." : "Run trial-ending reminders"}
          </button>
          {actionMessage ? <p className="muted">{actionMessage}</p> : null}
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Support</p>
        <h2>What this slice covers</h2>
        <p className="muted">
          This phase 1 superadmin slice now covers tenant visibility, billing controls, support queues,
          usage reporting, and platform maintenance messaging.
        </p>
        <Link href="/support">Open support queue</Link>
        <Link href="/audit">Review audit trail</Link>
        <button
          onClick={() => {
            clearSuperadminToken();
            router.replace("/login");
          }}
          type="button"
        >
          Sign out
        </button>
      </article>
      {message ? (
        <article className="panel">
          <p className="muted">{message}</p>
        </article>
      ) : null}
    </section>
  );
}

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "12px"
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
