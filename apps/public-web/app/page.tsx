import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <section className="hero-card">
        <p className="eyebrow">Spa SaaS</p>
        <h1>Run branches, bookings, staff, and billing from one calm system.</h1>
        <p className="muted">
          AdeyApp is a multi-tenant platform for spa owners, reception teams, employees,
          customers, and the superadmin team behind the service.
        </p>
        <div className="cta-row">
          <Link className="button" href="/signup">
            Start onboarding
          </Link>
          <Link className="button-secondary" href="/pricing">
            View plans
          </Link>
        </div>
      </section>
      <section className="grid">
        <article className="section-card">
          <h2>Public web</h2>
          <p className="muted">Marketing, pricing, FAQs, support, and self-serve sign-up.</p>
        </article>
        <article className="section-card">
          <h2>Tenant operations</h2>
          <p className="muted">Branches, appointments, staff attendance, policies, and billing.</p>
        </article>
        <article className="section-card">
          <h2>Platform control</h2>
          <p className="muted">Superadmin tools for tenants, plans, quotas, and support.</p>
        </article>
      </section>
    </main>
  );
}
