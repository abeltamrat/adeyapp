"use client";

import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SuperadminAuditEntrySummary, SuperadminTenantSummary } from "@adeyapp/types";
import {
  clearSuperadminToken,
  hasSuperadminToken,
  hydrateSuperadminApi,
  superadminApi
} from "../../lib/api";

export default function AuditPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<SuperadminAuditEntrySummary[]>([]);
  const [tenants, setTenants] = useState<SuperadminTenantSummary[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSuperadminToken()) {
      router.replace("/login");
      return;
    }

    hydrateSuperadminApi();
    let active = true;

    async function loadAudit() {
      setLoading(true);
      setMessage(null);

      try {
        const [tenantRows, auditRows] = await Promise.all([
          superadminApi.superadmin.listTenants(),
          superadminApi.superadmin.listAuditEntries()
        ]);

        if (!active) {
          return;
        }

        setTenants(tenantRows);
        setEntries(auditRows);
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError && issue.details.status === 401) {
          clearSuperadminToken();
          router.replace("/login");
          return;
        }

        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load the audit trail.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAudit();

    return () => {
      active = false;
    };
  }, [router]);

  async function runFilter() {
    setLoading(true);
    setMessage(null);

    try {
      const rows = await superadminApi.superadmin.listAuditEntries({
        tenantId: tenantId || undefined,
        actionKey: actionKey || undefined,
        limit: "100"
      });
      setEntries(rows);
    } catch (issue) {
      if (issue instanceof ApiError && issue.details.status === 401) {
        clearSuperadminToken();
        router.replace("/login");
        return;
      }

      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to filter audit entries.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid">
      <article className="panel">
        <p className="eyebrow">Audit</p>
        <h1>Platform audit trail</h1>
        <p className="muted">
          Review sensitive cross-tenant actions, support interventions, subscription changes, and staff events.
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
            <span>Action key</span>
            <input
              onChange={(event) => setActionKey(event.target.value)}
              placeholder="superadmin.invoice_created"
              style={inputStyle}
              value={actionKey}
            />
          </label>
          <button disabled={loading} onClick={() => void runFilter()} type="button">
            {loading ? "Loading..." : "Apply filters"}
          </button>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Entries</p>
        <h2>Latest activity</h2>
        {entries.length ? (
          <div style={listStyle}>
            {entries.map((entry) => (
              <div key={entry.id} style={itemStyle}>
                <strong>{entry.actionKey}</strong>
                <p className="muted">
                  {entry.tenantName}
                  {entry.branchName ? ` | ${entry.branchName}` : ""}
                  {entry.actorEmail ? ` | ${entry.actorEmail}` : ""}
                </p>
                <p className="muted">
                  {entry.entityType} | {entry.entityId} | {entry.createdAt}
                </p>
                {entry.metadata ? (
                  <pre style={preStyle}>{JSON.stringify(entry.metadata, null, 2)}</pre>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{loading ? "Loading audit trail..." : "No audit entries matched the current filters."}</p>
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

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "#f4efe7",
  borderRadius: "12px",
  padding: "10px",
  overflowX: "auto",
  fontSize: "12px"
};
