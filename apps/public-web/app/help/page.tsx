import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 60px' }}>
        <span className="eyebrow">Help Center</span>
        <h1 className="page-title">How can we help you?</h1>
        <p className="muted hero-lead">
          Explore our guides, FAQs, and support resources to get the most out of AdeyApp.
        </p>
      </section>

      {/* Help Categories */}
      <section className="grid feature-grid">
        <article className="section-card">
          <div className="feature-icon">🚀</div>
          <h3>Getting Started</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Learn how to set up your workspace, add branches, and configure your first services.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Workspace initialization</li>
            <li>Branch & Room setup</li>
            <li>Staff onboarding</li>
            <li>Service & Product catalog</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">🛎️</div>
          <h3>Front Desk Ops</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Master the booking flow, manage the daily calendar, and handle customer check-ins.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Managing appointments</li>
            <li>Waitlist handling</li>
            <li>Customer profiles</li>
            <li>Front-desk check-in flow</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>⌚</div>
          <h3>Staff & Attendance</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Guidelines for employee check-ins, shift planning, and leave management.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Network-based check-in</li>
            <li>Shift & schedule visibility</li>
            <li>Leave & absence requests</li>
            <li>Performance reporting</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">💳</div>
          <h3>Billing & Plans</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Manage your subscription, view invoices, and understand your plan entitlements.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Plan upgrades & downgrades</li>
            <li>Invoice history</li>
            <li>Payment methods</li>
            <li>Quota management</li>
          </ul>
        </article>
      </section>

      {/* FAQ Section */}
      <section>
        <h2 className="section-title">Common Questions</h2>
        <div className="grid feature-grid">
          <div style={{ display: 'grid', gap: '32px' }}>
            <div>
              <h4 style={{ marginBottom: '12px' }}>Can I manage multiple locations?</h4>
              <p className="muted">Yes, AdeyApp is built for multi-branch operations. You can switch between branches seamlessly from your dashboard.</p>
            </div>
            <div>
              <h4 style={{ marginBottom: '12px' }}>Is there a mobile app for staff?</h4>
              <p className="muted">Absolutely. Staff can use the AdeyApp mobile client (Expo) to check their schedules and record attendance.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '32px' }}>
            <div>
              <h4 style={{ marginBottom: '12px' }}>How does attendance validation work?</h4>
              <p className="muted">Currently, we use approved network identifiers. We are adding GPS radius enforcement in the coming phase.</p>
            </div>
            <div>
              <h4 style={{ marginBottom: '12px' }}>What happens if I go offline?</h4>
              <p className="muted">Our front-desk flows include offline-safe actions that queue up and sync once you're back online.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ textAlign: 'center', background: 'var(--brand-soft)', padding: '80px', borderRadius: 'var(--radius-lg)' }}>
        <h2>Still need help?</h2>
        <p className="muted" style={{ marginBottom: '32px' }}>Our support team is just a message away.</p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link href="/contact" className="button">Contact Support</Link>
          <a href="mailto:support@adeyapp.com" className="button-secondary">Email us directly</a>
        </div>
      </section>
    </main>
  );
}

