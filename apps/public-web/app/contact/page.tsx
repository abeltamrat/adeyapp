import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section className="text-center max-w-800 mx-auto mb-60">
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
          <p className="muted mb-24">
            Get a personalized walkthrough of branch operations, staff flow, and platform controls.
          </p>
          <a href="mailto:sales@adeyapp.com?subject=Demo%20Request" className="button w-full text-center">Request Demo</a>
        </article>

        <article className="section-card">
          <div className="feature-icon">💰</div>
          <h3>Sales Inquiry</h3>
          <p className="muted mb-24">
            Questions about pricing, multi-branch rollouts, or custom enterprise requirements?
          </p>
          <a href="mailto:sales@adeyapp.com?subject=Sales%20Inquiry" className="button-secondary w-full text-center">Contact Sales</a>
        </article>

        <article className="section-card">
          <div className="feature-icon bg-brand-soft" style={{ color: 'var(--brand)' }}>🛠️</div>
          <h3>Technical Support</h3>
          <p className="muted mb-24">
            Existing tenant? Our support team is ready to help with any operational issues.
          </p>
          <a href="mailto:support@adeyapp.com?subject=Support%20Request" className="button-secondary w-full text-center">Email Support</a>
        </article>
      </section>

      {/* Info Section */}
      <section className="hero-split align-start section-card p-60 rounded-lg">
        <div>
          <h2>Expected Response Times</h2>
          <p className="muted mt-16">
            We value your time and aim to respond to all inquiries as quickly as possible.
          </p>
        </div>
        <div className="grid-gap-32 w-full">
          <div className="stat-row">
            <div className="grid-gap-32" style={{ gap: '4px' }}>
              <span className="font-semi">Sales & Demos</span>
              <span className="muted">Within 24 business hours</span>
            </div>
          </div>
          <div className="stat-row">
            <div className="grid-gap-32" style={{ gap: '4px' }}>
              <span className="font-semi">Priority Support</span>
              <span className="muted">Within 2-4 hours (Growth & Enterprise)</span>
            </div>
          </div>
          <div className="stat-row">
            <div className="grid-gap-32" style={{ gap: '4px' }}>
              <span className="font-semi">Standard Support</span>
              <span className="muted">Within 12-24 business hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* Location/Other Info Teaser */}
      <section className="text-center" style={{ padding: '40px 0' }}>
        <h3>Need immediate answers?</h3>
        <p className="muted mb-24">Check out our frequently asked questions in the help center.</p>
        <Link href="/help" className="button-secondary">Browse Help Center</Link>
      </section>
    </main>
  );
}

