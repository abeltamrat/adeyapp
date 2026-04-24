import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 60px' }}>
        <span className="eyebrow">Contact Us</span>
        <h1 className="page-title">We're here to help you grow.</h1>
        <p className="muted hero-lead">
          Whether you're looking for a demo, have sales questions, or need support, we've got the right path for you.
        </p>
      </section>

      {/* Contact Cards */}
      <section className="grid feature-grid">
        <article className="section-card">
          <div className="feature-icon" style={{ background: 'rgba(219, 141, 54, 0.1)', color: 'var(--accent)' }}>👋</div>
          <h3>Book a Demo</h3>
          <p className="muted" style={{ marginBottom: '24px' }}>
            Get a personalized walkthrough of branch operations, staff flow, and platform controls.
          </p>
          <a href="mailto:sales@adeyapp.com?subject=Demo%20Request" className="button" style={{ width: '100%', textAlign: 'center' }}>Request Demo</a>
        </article>

        <article className="section-card">
          <div className="feature-icon">💰</div>
          <h3>Sales Inquiry</h3>
          <p className="muted" style={{ marginBottom: '24px' }}>
            Questions about pricing, multi-branch rollouts, or custom enterprise requirements?
          </p>
          <a href="mailto:sales@adeyapp.com?subject=Sales%20Inquiry" className="button-secondary" style={{ width: '100%', textAlign: 'center' }}>Contact Sales</a>
        </article>

        <article className="section-card">
          <div className="feature-icon" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>🛠️</div>
          <h3>Technical Support</h3>
          <p className="muted" style={{ marginBottom: '24px' }}>
            Existing tenant? Our support team is ready to help with any operational issues.
          </p>
          <a href="mailto:support@adeyapp.com?subject=Support%20Request" className="button-secondary" style={{ width: '100%', textAlign: 'center' }}>Email Support</a>
        </article>
      </section>

      {/* Info Section */}
      <section className="hero-split" style={{ alignItems: 'flex-start', background: 'white', padding: '60px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}>
        <div>
          <h2>Expected Response Times</h2>
          <p className="muted" style={{ marginTop: '16px' }}>
            We value your time and aim to respond to all inquiries as quickly as possible.
          </p>
        </div>
        <div style={{ display: 'grid', gap: '24px', width: '100%' }}>
          <div className="stat-row">
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontWeight: '600' }}>Sales & Demos</span>
              <span className="muted">Within 24 business hours</span>
            </div>
          </div>
          <div className="stat-row">
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontWeight: '600' }}>Priority Support</span>
              <span className="muted">Within 2-4 hours (Growth & Enterprise)</span>
            </div>
          </div>
          <div className="stat-row">
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontWeight: '600' }}>Standard Support</span>
              <span className="muted">Within 12-24 business hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* Location/Other Info Teaser */}
      <section style={{ textAlign: 'center', padding: '40px 0' }}>
        <h3>Need immediate answers?</h3>
        <p className="muted" style={{ marginBottom: '24px' }}>Check out our frequently asked questions in the help center.</p>
        <Link href="/help" className="button-secondary">Browse Help Center</Link>
      </section>
    </main>
  );
}

