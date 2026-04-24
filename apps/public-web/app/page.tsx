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
      <section className="hero-split rtl text-left">
        <div className="hero-copy ltr">
          <span className="eyebrow">Multi-Branch Management</span>
          <h2>Grow beyond one front desk.</h2>
          <p className="muted font-lg leading-relaxed mb-24">
            Manage multiple branches with branch-specific rooms, services, and staff. Get consolidated reports or drill down into individual branch performance.
          </p>
          <div className="stat-row">
            <strong>✓</strong>
            <span>Branch-specific policies & pricing</span>
          </div>
          <div className="stat-row mt-12">
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
      <section className="section-card bg-brand-soft border-none text-center p-60">
        <span className="eyebrow">Platform Integrity</span>
        <h2 className="mb-24">Enterprise-grade control for operators.</h2>
        <p className="muted max-w-700 mx-auto mb-40 font-lg">
          AdeyApp isn't just a booking tool. It's a tenant management system with full audit logs, billing entitlements, and support integration.
        </p>
        <Link className="button" href="/features">
          Explore All Features
        </Link>
      </section>

      {/* CTA Section */}
      <section className="text-center p-0-40">
        <h2 className="section-title">Ready to calm the chaos?</h2>
        <p className="muted max-w-600 mx-auto mt-neg-24 mb-40">
          Join the growing list of spa owners who trust AdeyApp for their daily operations.
        </p>
        <div className="cta-row flex-center">
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

