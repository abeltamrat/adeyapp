import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="page-stack">
      {/* Hero Section */}
      <section className="hero-split">
        <div className="hero-copy">
          <span className="eyebrow">Spa Operations Platform</span>
          <h1>One calm system for your entire spa operation.</h1>
          <p className="hero-lead muted">
            AdeyApp brings bookings, staff attendance, branch management, and customer care into one connected product family. Built for owners who value operations over noise.
          </p>
          <div className="cta-row">
            <Link className="button" href="/signup">
              Start Onboarding
            </Link>
            <Link className="button-secondary" href="/contact">
              Book a Demo
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <Image 
            src="/hero-mockup.png" 
            alt="AdeyApp Dashboard Mockup" 
            width={600} 
            height={400} 
            priority
            className="hero-image"
          />
        </div>
      </section>

      {/* Role Strip */}
      <section>
        <h2 className="section-title">Built for every role in your business.</h2>
        <div className="grid feature-grid">
          <div className="section-card">
            <div className="feature-icon">🏢</div>
            <h3>Owners</h3>
            <p className="muted">Manage branches, policies, and high-level reporting from a central workspace.</p>
          </div>
          <div className="section-card">
            <div className="feature-icon">📅</div>
            <h3>Receptionists</h3>
            <p className="muted">Streamline bookings, check-ins, and waitlists with an intuitive front-desk flow.</p>
          </div>
          <div className="section-card">
            <div className="feature-icon">👥</div>
            <h3>Employees</h3>
            <p className="muted">Track shifts, attendance, and work records with approved-network validation.</p>
          </div>
          <div className="section-card">
            <div className="feature-icon">✨</div>
            <h3>Customers</h3>
            <p className="muted">Enjoy seamless self-booking, appointment history, and real-time notifications.</p>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="hero-split" style={{ direction: 'rtl', textAlign: 'left' }}>
        <div className="hero-copy" style={{ direction: 'ltr' }}>
          <span className="eyebrow">Multi-Branch Management</span>
          <h2>Grow beyond one front desk.</h2>
          <p className="muted" style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Manage multiple branches with branch-specific rooms, services, and staff. Get consolidated reports or drill down into individual branch performance.
          </p>
          <div className="stat-row">
            <strong>✓</strong>
            <span>Branch-specific policies & pricing</span>
          </div>
          <div className="stat-row" style={{ marginTop: '12px' }}>
            <strong>✓</strong>
            <span>Centralized inventory control</span>
          </div>
        </div>
        <div className="hero-visual">
           <Image 
            src="/features.png" 
            alt="AdeyApp Features Illustration" 
            width={500} 
            height={400} 
          />
        </div>
      </section>

      {/* Platform Control */}
      <section className="section-card" style={{ background: 'var(--brand-soft)', border: 'none', textAlign: 'center', padding: '60px' }}>
        <span className="eyebrow">Platform Integrity</span>
        <h2 style={{ marginBottom: '24px' }}>Enterprise-grade control for operators.</h2>
        <p className="muted" style={{ maxWidth: '700px', margin: '0 auto 40px', fontSize: '1.1rem' }}>
          AdeyApp isn't just a booking tool. It's a tenant management system with full audit logs, billing entitlements, and support integration.
        </p>
        <Link className="button" href="/features">
          Explore All Features
        </Link>
      </section>

      {/* CTA Section */}
      <section style={{ textAlign: 'center', padding: '40px 0' }}>
        <h2 className="section-title">Ready to calm the chaos?</h2>
        <p className="muted" style={{ maxWidth: '600px', margin: '-24px auto 40px' }}>
          Join the growing list of spa owners who trust AdeyApp for their daily operations.
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="button" href="/signup">
            Get Started Today
          </Link>
          <Link className="button-secondary" href="/pricing">
            View Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}

