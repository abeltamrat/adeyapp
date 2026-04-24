import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="page-stack">
      <section className="section-card page-hero-card">
        <p className="eyebrow">Login</p>
        <h1 className="page-title">Choose the login route that matches who you are.</h1>
        <p className="muted hero-lead">
          AdeyApp serves several different user groups. This page should reduce confusion for
          first-time visitors until deeper cross-app authentication handoff is finalized.
        </p>
      </section>

      <section className="info-grid">
        <article className="section-card info-card">
          <p className="eyebrow">Tenant Staff</p>
          <h2>Owners, managers, receptionists, and employees</h2>
          <p className="muted">
            Use the tenant app if you work inside a spa workspace and need access to daily
            operations, attendance, bookings, policies, or payroll-related flows.
          </p>
          <div className="cta-row">
            <a className="button" href="exp://127.0.0.1:8081">
              Open tenant app
            </a>
          </div>
        </article>

        <article className="section-card info-card">
          <p className="eyebrow">Customers</p>
          <h2>Customers viewing bookings and profile history</h2>
          <p className="muted">
            Use the customer app if you are booking services, checking appointment history,
            or reviewing customer notifications.
          </p>
          <div className="cta-row">
            <a className="button" href="exp://127.0.0.1:8082">
              Open customer app
            </a>
          </div>
        </article>

        <article className="section-card info-card">
          <p className="eyebrow">Platform Team</p>
          <h2>Superadmin and platform operations users</h2>
          <p className="muted">
            Use the superadmin web interface if you manage tenants, billing, module access,
            support queues, or platform-wide maintenance operations.
          </p>
          <div className="cta-row">
            <a className="button" href="http://localhost:3001/login">
              Open superadmin
            </a>
          </div>
        </article>
      </section>

      <section className="section-card">
        <p className="muted">
          New to AdeyApp? Start from the sign-up route so you choose the right onboarding path
          first.
        </p>
        <div className="cta-row">
          <Link className="button-secondary" href="/signup">
            Go to sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
