export default function PricingPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 60px' }}>
        <span className="eyebrow">Pricing & Plans</span>
        <h1 className="page-title">Plans that match your growth.</h1>
        <p className="muted hero-lead">
          From a single boutique spa to a multi-branch enterprise, AdeyApp provides the operations core you need to run calmly and scale efficiently.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="pricing-grid">
        <article className="section-card pricing-card">
          <span className="eyebrow">Starter</span>
          <h2>Boutique Essentials</h2>
          <div className="price">$49<span>/month</span></div>
          <p className="muted">Best for single-branch spas that need robust daily operations without the noise.</p>
          <ul className="feature-list">
            <li>1 branch workspace</li>
            <li>Full reception booking flow</li>
            <li>Staff attendance tracking</li>
            <li>Customer self-booking portal</li>
            <li>Email & Push notifications</li>
          </ul>
          <a href="/signup" className="button-secondary" style={{ marginTop: 'auto', textAlign: 'center' }}>Start with Starter</a>
        </article>

        <article className="section-card pricing-card pricing-card-highlight">
          <span className="eyebrow">Growth</span>
          <h2>Multi-Branch Pro</h2>
          <div className="price">$99<span>/month</span></div>
          <p className="muted">Designed for operators managing multiple locations and active professional teams.</p>
          <ul className="feature-list">
            <li>Unlimited branch workspaces</li>
            <li>Shift planning & leave management</li>
            <li>Waitlist & advanced reporting</li>
            <li>Inventory & Procurement control</li>
            <li>Payroll & employee credit flows</li>
          </ul>
          <a href="/signup" className="button" style={{ marginTop: 'auto', textAlign: 'center' }}>Scale with Growth</a>
        </article>

        <article className="section-card pricing-card">
          <span className="eyebrow">Enterprise</span>
          <h2>Platform Custom</h2>
          <div className="price">Contact<span>Sales</span></div>
          <p className="muted">For large-scale operators requiring custom governance and branded rollouts.</p>
          <ul className="feature-list">
            <li>Advanced quotas & entitlements</li>
            <li>Custom branding & Whitelabel path</li>
            <li>Priority enterprise support</li>
            <li>Platform-level API access</li>
            <li>Dedicated rollout success manager</li>
          </ul>
          <a href="/contact" className="button-secondary" style={{ marginTop: 'auto', textAlign: 'center' }}>Talk to Sales</a>
        </article>
      </section>

      {/* Comparison Table */}
      <section className="section-card" style={{ padding: '60px' }}>
        <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '40px' }}>Compare capabilities</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '16px 8px', color: 'var(--muted)', fontWeight: '600' }}>Feature</th>
                <th style={{ padding: '16px 8px', color: 'var(--ink)', fontWeight: '700' }}>Starter</th>
                <th style={{ padding: '16px 8px', color: 'var(--ink)', fontWeight: '700' }}>Growth</th>
                <th style={{ padding: '16px 8px', color: 'var(--ink)', fontWeight: '700' }}>Enterprise</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--muted)' }}>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px 8px', fontWeight: '500', color: 'var(--ink)' }}>Branch Count</td>
                <td style={{ padding: '16px 8px' }}>Single</td>
                <td style={{ padding: '16px 8px' }}>Unlimited</td>
                <td style={{ padding: '16px 8px' }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px 8px', fontWeight: '500', color: 'var(--ink)' }}>Booking Desk</td>
                <td style={{ padding: '16px 8px' }}>✓</td>
                <td style={{ padding: '16px 8px' }}>✓</td>
                <td style={{ padding: '16px 8px' }}>✓</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px 8px', fontWeight: '500', color: 'var(--ink)' }}>Shift/Leave Tools</td>
                <td style={{ padding: '16px 8px' }}>Basic</td>
                <td style={{ padding: '16px 8px' }}>Advanced</td>
                <td style={{ padding: '16px 8px' }}>Advanced</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px 8px', fontWeight: '500', color: 'var(--ink)' }}>Inventory Control</td>
                <td style={{ padding: '16px 8px' }}>-</td>
                <td style={{ padding: '16px 8px' }}>✓</td>
                <td style={{ padding: '16px 8px' }}>✓</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '16px 8px', fontWeight: '500', color: 'var(--ink)' }}>Whitelabel Path</td>
                <td style={{ padding: '16px 8px' }}>-</td>
                <td style={{ padding: '16px 8px' }}>Limited</td>
                <td style={{ padding: '16px 8px' }}>Full Priority</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section style={{ textAlign: 'center', background: 'var(--brand-soft)', padding: '60px', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ marginBottom: '16px' }}>Frequently Asked Questions</h2>
        <p className="muted" style={{ marginBottom: '32px' }}>Have more questions about our plans?</p>
        <a href="/help" className="button-secondary">Visit Help Center</a>
      </section>
    </main>
  );
}

