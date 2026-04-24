import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="page-stack">
      <section className="section-card page-hero-card">
        <p className="eyebrow">Sign Up</p>
        <h1 className="page-title">Start the path that fits your role in the product.</h1>
        <p className="muted hero-lead">
          AdeyApp has different entry points for workspace creation, customer access, and
          platform administration. This page helps a new visitor choose correctly before
          jumping into onboarding.
        </p>
      </section>

      <section className="info-grid">
        <article className="section-card info-card">
          <p className="eyebrow">Create A Workspace</p>
          <h2>For spa owners starting a new tenant</h2>
          <p className="muted">
            Create the first workspace, first branch, core services, products, rooms, and staff
            access from the tenant onboarding flow.
          </p>
          <div className="cta-row">
            <a className="button" href="exp://127.0.0.1:8081/login">
              Start owner onboarding
            </a>
          </div>
        </article>

        <article className="section-card info-card">
          <p className="eyebrow">Join As A Customer</p>
          <h2>For customers who want self-service booking access</h2>
          <p className="muted">
            Customers should use the customer app to register, book services, and manage
            appointment history.
          </p>
          <div className="cta-row">
            <a className="button" href="exp://127.0.0.1:8082/login">
              Open customer app
            </a>
          </div>
        </article>

        <article className="section-card info-card">
          <p className="eyebrow">Need Guidance First?</p>
          <h2>Talk to the team before starting.</h2>
          <p className="muted">
            If you are not sure which plan or rollout path fits your spa, use the contact route
            before creating the workspace.
          </p>
          <div className="cta-row">
            <Link className="button-secondary" href="/contact">
              Contact team
            </Link>
            <Link className="button-secondary" href="/pricing">
              Review plans
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
