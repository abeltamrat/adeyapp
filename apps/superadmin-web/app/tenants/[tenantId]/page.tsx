"use client";

import { ApiError } from "@adeyapp/api-client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SuperadminTenantDetail } from "@adeyapp/types";
import {
  clearSuperadminToken,
  hasSuperadminToken,
  hydrateSuperadminApi,
  superadminApi
} from "../../../lib/api";

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const router = useRouter();
  const tenantId = typeof params?.tenantId === "string" ? params.tenantId : "";
  const [tenant, setTenant] = useState<SuperadminTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [planCode, setPlanCode] = useState("starter");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SuperadminTenantDetail["subscriptionStatus"]>("active");
  const [renewsAt, setRenewsAt] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("0");
  const [invoiceDueAt, setInvoiceDueAt] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [moduleEntitlements, setModuleEntitlements] = useState<SuperadminTenantDetail["moduleEntitlements"]>({
    inventory: true,
    employeeCredit: true,
    notifications: true,
    customerAccounts: true
  });

  useEffect(() => {
    if (!hasSuperadminToken()) {
      router.replace("/login");
      return;
    }

    hydrateSuperadminApi();
    let active = true;

    async function loadTenant() {
      setLoading(true);
      setMessage(null);

      try {
        const nextTenant = await superadminApi.superadmin.getTenant(tenantId);
        if (active) {
          setTenant(nextTenant);
          setPlanCode(nextTenant.currentPlanCode ?? "starter");
          setSubscriptionStatus(nextTenant.subscriptionStatus ?? "active");
          setRenewsAt(nextTenant.renewsAt ? nextTenant.renewsAt.slice(0, 16) : "");
          setInvoiceAmount(nextTenant.latestInvoice?.totalAmount ?? "0");
          setPaymentAmount(nextTenant.latestInvoice?.totalAmount ?? "0");
          setModuleEntitlements(nextTenant.moduleEntitlements);
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

        setMessage(issue instanceof ApiError ? issue.details.message : "Unable to load tenant detail.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (tenantId) {
      void loadTenant();
    }

    return () => {
      active = false;
    };
  }, [router, tenantId]);

  async function updateStatus(status: SuperadminTenantDetail["status"]) {
    if (!tenant) {
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.updateTenantStatus(tenant.id, { status });
      setTenant(updated);
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to update tenant.");
    } finally {
      setUpdating(false);
    }
  }

  async function saveSubscription() {
    if (!tenant || !subscriptionStatus) {
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.upsertSubscription(tenant.id, {
        planCode,
        status: subscriptionStatus,
        renewsAt: renewsAt ? new Date(renewsAt).toISOString() : undefined
      });
      setTenant(updated);
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to update subscription.");
    } finally {
      setUpdating(false);
    }
  }

  async function createInvoice() {
    if (!tenant) {
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.createInvoice(tenant.id, {
        totalAmount: Number(invoiceAmount),
        dueAt: invoiceDueAt ? new Date(invoiceDueAt).toISOString() : undefined,
        status: "issued"
      });
      setTenant(updated);
      setPaymentAmount(updated.latestInvoice?.totalAmount ?? paymentAmount);
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to create invoice.");
    } finally {
      setUpdating(false);
    }
  }

  async function recordPayment() {
    if (!tenant?.latestInvoice) {
      setMessage("Create an invoice first before recording payment.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.recordPayment(tenant.latestInvoice.id, {
        amount: Number(paymentAmount),
        paymentMethod,
        status: "succeeded"
      });
      setTenant(updated);
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to record payment.");
    } finally {
      setUpdating(false);
    }
  }

  async function saveModules() {
    if (!tenant) {
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const updated = await superadminApi.superadmin.updateTenantModules(tenant.id, moduleEntitlements);
      setTenant(updated);
      setModuleEntitlements(updated.moduleEntitlements);
    } catch (issue) {
      setMessage(issue instanceof ApiError ? issue.details.message : "Unable to update tenant modules.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <section className="grid">
      <article className="panel">
        <p className="eyebrow">Tenant Detail</p>
        {loading ? (
          <p className="muted">Loading tenant detail...</p>
        ) : tenant ? (
          <>
            <h1>{tenant.name}</h1>
            <p className="muted">
              {tenant.slug} • {tenant.status} • {tenant.currentPlanCode ?? "no plan"}
            </p>
            <p className="muted">Owner: {tenant.ownerEmail ?? "unknown"}</p>
            <p className="muted">
              Branches: {tenant.branchCount} • Employees: {tenant.employeeCount} • Appointments:{" "}
              {tenant.appointmentCount}
            </p>
            <p className="muted">
              Subscription: {tenant.subscriptionStatus ?? "untracked"} • Renews:{" "}
              {tenant.renewsAt ?? "n/a"}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tenant.status !== "active" ? (
                <button disabled={updating} onClick={() => void updateStatus("active")} type="button">
                  Reactivate
                </button>
              ) : (
                <button
                  disabled={updating}
                  onClick={() => void updateStatus("suspended")}
                  type="button"
                >
                  Suspend
                </button>
              )}
              {tenant.status !== "grace_period" ? (
                <button
                  disabled={updating}
                  onClick={() => void updateStatus("grace_period")}
                  type="button"
                >
                  Move to grace period
                </button>
              ) : null}
              {tenant.status !== "archived" ? (
                <button disabled={updating} onClick={() => void updateStatus("archived")} type="button">
                  Archive
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">Tenant not found.</p>
        )}
      </article>
      <article className="panel">
        <p className="eyebrow">Latest invoice</p>
        {tenant?.latestInvoice ? (
          <>
            <h2>{tenant.latestInvoice.invoiceNumber}</h2>
            <p className="muted">
              {tenant.latestInvoice.status} • {tenant.latestInvoice.totalAmount}
            </p>
            <p className="muted">Due: {tenant.latestInvoice.dueAt ?? "n/a"}</p>
          </>
        ) : (
          <p className="muted">No invoice has been recorded yet.</p>
        )}
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <input onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="Invoice amount" type="number" value={invoiceAmount} />
          <input onChange={(event) => setInvoiceDueAt(event.target.value)} placeholder="Due at" type="datetime-local" value={invoiceDueAt} />
          <button disabled={updating} onClick={() => void createInvoice()} type="button">
            Create invoice
          </button>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Latest payment</p>
        {tenant?.latestPayment ? (
          <>
            <h2>{tenant.latestPayment.amount}</h2>
            <p className="muted">
              {tenant.latestPayment.status} • {tenant.latestPayment.paymentMethod}
            </p>
            <p className="muted">Paid at: {tenant.latestPayment.paidAt ?? "n/a"}</p>
          </>
        ) : (
          <p className="muted">No payment has been recorded yet.</p>
        )}
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <input onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Payment amount" type="number" value={paymentAmount} />
          <input onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Payment method" value={paymentMethod} />
          <button disabled={updating} onClick={() => void recordPayment()} type="button">
            Record payment
          </button>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Subscription</p>
        <h2>Plan assignment</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <input onChange={(event) => setPlanCode(event.target.value)} placeholder="Plan code" value={planCode} />
          <select
            onChange={(event) =>
              setSubscriptionStatus(event.target.value as NonNullable<SuperadminTenantDetail["subscriptionStatus"]>)
            }
            value={subscriptionStatus ?? "active"}
          >
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="grace_period">grace_period</option>
            <option value="suspended">suspended</option>
            <option value="canceled">canceled</option>
          </select>
          <input onChange={(event) => setRenewsAt(event.target.value)} placeholder="Renews at" type="datetime-local" value={renewsAt} />
          <button disabled={updating} onClick={() => void saveSubscription()} type="button">
            Save subscription
          </button>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">Modules</p>
        <h2>Tenant entitlements</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { key: "inventory", label: "Inventory and products" },
            { key: "employeeCredit", label: "Employee credit" },
            { key: "notifications", label: "Notifications" },
            { key: "customerAccounts", label: "Customer accounts" }
          ].map((item) => (
            <label
              key={item.key}
              style={{ display: "flex", alignItems: "center", gap: 8, color: "#4f5d5f" }}
            >
              <input
                checked={moduleEntitlements[item.key as keyof typeof moduleEntitlements]}
                onChange={(event) =>
                  setModuleEntitlements((current) => ({
                    ...current,
                    [item.key]: event.target.checked
                  }))
                }
                type="checkbox"
              />
              {item.label}
            </label>
          ))}
          <button disabled={updating} onClick={() => void saveModules()} type="button">
            Save modules
          </button>
        </div>
      </article>
      {message ? (
        <article className="panel">
          <p className="muted">{message}</p>
        </article>
      ) : null}
    </section>
  );
}
