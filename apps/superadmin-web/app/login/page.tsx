"use client";

import { ApiError } from "@adeyapp/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSuperadminToken, superadminApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const session = await superadminApi.auth.login({ email, password });
      saveSuperadminToken(session.accessToken);
      await superadminApi.superadmin.getDashboard();
      router.replace("/dashboard");
    } catch (issue) {
      if (issue instanceof ApiError) {
        setMessage(issue.details.message);
      } else {
        setMessage("Unable to sign in right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel" style={{ maxWidth: 480 }}>
      <p className="eyebrow">Superadmin Login</p>
      <h1>Sign in to platform control</h1>
      <p className="muted">
        Use a platform user account to manage tenants, monitor subscription state, and suspend or
        reactivate workspaces.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          type="email"
          value={email}
        />
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        <button disabled={submitting} type="submit">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
