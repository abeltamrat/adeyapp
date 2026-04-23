"use client";

import { ApiError } from "@adeyapp/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SuperadminTenantSummary } from "@adeyapp/types";
import {
  clearSuperadminToken,
  hasSuperadminToken,
  hydrateSuperadminApi,
  superadminApi
} from "../../lib/api";

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<SuperadminTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSuperadminToken()) {
      router.replace("/login");
      return;
    }

    hydrateSuperadminApi();
    let active = true;

    async function loadTenants() {
      setLoading(true);
      setMessage(null);

      try {
        const nextTenants = await superadminApi.superadmin.listTenants();
        if (active) {
          setTenants(nextTenants);
        }
      } catch (issue) {
        if (!active) {
          return;
        }

        if (issue instanceof ApiError && issue.details.status === 401) {
          clearSuperadminToken();
          router.replace("/login");
          return;
        }

        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load tenants.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTenants();

    return () => {
      active = false;
    };
  }, [router]);

  async function updateStatus(tenantId: string, status: SuperadminTenantSummary["status"]) {
    setUpdatingTenantId(tenantId);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.updateTenantStatus(tenantId, { status });
      setTenants((current) => current.map((tenant) => (tenant.id === updated.id ? updated : tenant)));
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to update tenant status.");
    } finally {
      setUpdatingTenantId(null);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Tenants</p>
      <h1>Tenant list</h1>
      <p className="muted">Review workspace status, subscription state, and operational footprint.</p>
      {loading ? <p className="muted">Loading tenants...</p> : null}
      <div className="grid">
        {tenants.map((tenant) => (
          <article key={tenant.id} className="panel">
            <h2>{tenant.name}</h2>
            <p className="muted">
              {tenant.slug} • {tenant.status} • {tenant.currentPlanCode ?? "no plan"}
            </p>
            <p className="muted">
              Owner: {tenant.ownerEmail ?? "unknown"} • Branches: {tenant.branchCount} • Employees:{" "}
              {tenant.employeeCount}
            </p>
            <p className="muted">
              Appointments: {tenant.appointmentCount} • Subscription:{" "}
              {tenant.subscriptionStatus ?? "untracked"}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/tenants/${tenant.id}`}>Open detail</Link>
              {tenant.status !== "active" ? (
                <button
                  disabled={updatingTenantId === tenant.id}
                  onClick={() => void updateStatus(tenant.id, "active")}
                  type="button"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  disabled={updatingTenantId === tenant.id}
                  onClick={() => void updateStatus(tenant.id, "suspended")}
                  type="button"
                >
                  Suspend
                </button>
              )}
              {tenant.status !== "archived" ? (
                <button
                  disabled={updatingTenantId === tenant.id}
                  onClick={() => void updateStatus(tenant.id, "archived")}
                  type="button"
                >
                  Archive
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
