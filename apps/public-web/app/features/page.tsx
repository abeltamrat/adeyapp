import Link from "next/link";

export default function FeaturesPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 60px' }}>
        <span className="eyebrow">Product Features</span>
        <h1 className="page-title">Built for the way you work.</h1>
        <p className="muted hero-lead">
          AdeyApp is designed around the real people who run and use a spa business. Each role gets exactly what they need to stay productive and calm.
        </p>
      </section>

      {/* Role Sections */}
      <section className="grid feature-grid">
        <article className="section-card">
          <div className="feature-icon">🏢</div>
          <span className="eyebrow">For Owners</span>
          <h3>Business Integrity</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Strategic control over your entire operation, from branch growth to financial health.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Multi-branch configuration</li>
            <li>Policy & governance engine</li>
            <li>Financial reporting & billing</li>
            <li>Staff lifecycle management</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">👔</div>
          <span className="eyebrow">For Managers</span>
          <h3>Operational Oversight</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>The tools you need to keep daily activities moving without losing control.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Shift planning & approval</li>
            <li>Attendance review & correction</li>
            <li>Branch-level performance</li>
            <li>Inventory & stock control</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">🛎️</div>
          <span className="eyebrow">For Receptionists</span>
          <h3>Seamless Front Desk</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Manage bookings and walk-ins with a flow that never skips a beat.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Intelligent booking calendar</li>
            <li>Waitlist & check-in flow</li>
            <li>Customer profile history</li>
            <li>Offline-safe operation queue</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">👥</div>
          <span className="eyebrow">For Employees</span>
          <h3>Daily Clarity</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>See your schedule and record your contributions with zero friction.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Network-verified check-in</li>
            <li>Shift & schedule visibility</li>
            <li>Service performance logs</li>
            <li>Leave & credit requests</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">✨</div>
          <span className="eyebrow">For Customers</span>
          <h3>Premium Experience</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Book your favorite services and track your appointments effortlessly.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Self-service booking portal</li>
            <li>Appointment history & status</li>
            <li>Real-time notifications</li>
            <li>Profile & preference control</li>
          </ul>
        </article>

        <article className="section-card">
          <div className="feature-icon">⚙️</div>
          <span className="eyebrow">For Superadmins</span>
          <h3>Platform Scale</h3>
          <p className="muted" style={{ marginBottom: '16px' }}>Control the entire SaaS ecosystem with enterprise-grade governance.</p>
          <ul className="feature-list" style={{ fontSize: '0.875rem' }}>
            <li>Tenant lifecycle automation</li>
            <li>Module gating & entitlements</li>
            <li>Platform-wide audit review</li>
            <li>System maintenance messaging</li>
          </ul>
        </article>
      </section>

      {/* Spotlight Section */}
      <section className="section-card" style={{ background: 'var(--ink)', color: 'white', border: 'none', padding: '60px' }}>
        <div className="hero-split">
          <div className="hero-copy">
            <span className="eyebrow" style={{ color: 'var(--brand)' }}>Advanced Logic</span>
            <h2 style={{ marginBottom: '24px' }}>Smart Overlap Protection</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', lineHeight: '1.6' }}>
              AdeyApp's core engine ensures that rooms and employees are never double-booked. It intelligently calculates cleanup buffers and service durations to keep your operations realistic and calm.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="stat-row" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <strong style={{ color: 'var(--brand)' }}>✓</strong>
              <span style={{ color: 'white' }}>Room capacity validation</span>
            </div>
            <div className="stat-row" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <strong style={{ color: 'var(--brand)' }}>✓</strong>
              <span style={{ color: 'white' }}>Employee skill-matching</span>
            </div>
            <div className="stat-row" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <strong style={{ color: 'var(--brand)' }}>✓</strong>
              <span style={{ color: 'white' }}>Buffer time automation</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ textAlign: 'center', padding: '40px 0' }}>
        <h2>Ready to experience AdeyApp?</h2>
        <p className="muted" style={{ marginBottom: '32px' }}>Start your journey toward operational excellence today.</p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link href="/signup" className="button">Get Started</Link>
          <Link href="/contact" className="button-secondary">Book a Demo</Link>
        </div>
      </section>
    </main>
  );
}

