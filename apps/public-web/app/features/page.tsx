import Link from "next/link";

export default function FeaturesPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section className="text-center max-w-800 mx-auto mb-60">
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
          <p className="muted mb-16">Strategic control over your entire operation, from branch growth to financial health.</p>
          <ul className="feature-list font-sm">
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
          <p className="muted mb-16">The tools you need to keep daily activities moving without losing control.</p>
          <ul className="feature-list font-sm">
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
          <p className="muted mb-16">Manage bookings and walk-ins with a flow that never skips a beat.</p>
          <ul className="feature-list font-sm">
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
          <p className="muted mb-16">See your schedule and record your contributions with zero friction.</p>
          <ul className="feature-list font-sm">
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
          <p className="muted mb-16">Book your favorite services and track your appointments effortlessly.</p>
          <ul className="feature-list font-sm">
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
          <p className="muted mb-16">Control the entire SaaS ecosystem with enterprise-grade governance.</p>
          <ul className="feature-list font-sm">
            <li>Tenant lifecycle automation</li>
            <li>Module gating & entitlements</li>
            <li>Platform-wide audit review</li>
            <li>System maintenance messaging</li>
          </ul>
        </article>
      </section>

      {/* Spotlight Section */}
      <section className="section-card bg-ink text-white border-none p-60">
        <div className="hero-split">
          <div className="hero-copy">
            <span className="eyebrow">Advanced Logic</span>
            <h2 className="mb-24">Smart Overlap Protection</h2>
            <p className="text-muted-white font-lg leading-relaxed">
              AdeyApp's core engine ensures that rooms and employees are never double-booked. It intelligently calculates cleanup buffers and service durations to keep your operations realistic and calm.
            </p>
          </div>
          <div className="grid-gap-12">
            <div className="stat-row bg-white-5 border-white-10">
              <strong className="brand">✓</strong>
              <span className="text-white">Room capacity validation</span>
            </div>
            <div className="stat-row bg-white-5 border-white-10">
              <strong className="brand">✓</strong>
              <span className="text-white">Employee skill-matching</span>
            </div>
            <div className="stat-row bg-white-5 border-white-10">
              <strong className="brand">✓</strong>
              <span className="text-white">Buffer time automation</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center p-0-40">
        <h2>Ready to experience AdeyApp?</h2>
        <p className="muted mb-32">Start your journey toward operational excellence today.</p>
        <div className="cta-row flex-center">
          <Link href="/signup" className="button">Get Started</Link>
          <Link href="/contact" className="button-secondary">Book a Demo</Link>
        </div>
      </section>
    </main>
  );
}

