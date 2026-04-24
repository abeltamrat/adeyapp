export default function PricingPage() {
  return (
    <main className="page-stack">
      {/* Page Header */}
      <section className="text-center max-w-800 mx-auto mb-60">
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
          <a href="/signup" className="button-secondary mt-auto text-center">Start with Starter</a>
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
          <a href="/signup" className="button mt-auto text-center">Scale with Growth</a>
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
          <a href="/contact" className="button-secondary mt-auto text-center">Talk to Sales</a>
        </article>
      </section>

      {/* Comparison Table */}
      <section className="section-card p-60">
        <h2 className="section-title text-left mb-40">Compare capabilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2">
                <th className="p-16-8 muted font-semi">Feature</th>
                <th className="p-16-8 ink bold">Starter</th>
                <th className="p-16-8 ink bold">Growth</th>
                <th className="p-16-8 ink bold">Enterprise</th>
              </tr>
            </thead>
            <tbody className="muted">
              <tr className="border-b">
                <td className="p-16-8 font-semi ink">Branch Count</td>
                <td className="p-16-8">Single</td>
                <td className="p-16-8">Unlimited</td>
                <td className="p-16-8">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-16-8 font-semi ink">Booking Desk</td>
                <td className="p-16-8">✓</td>
                <td className="p-16-8">✓</td>
                <td className="p-16-8">✓</td>
              </tr>
              <tr className="border-b">
                <td className="p-16-8 font-semi ink">Shift/Leave Tools</td>
                <td className="p-16-8">Basic</td>
                <td className="p-16-8">Advanced</td>
                <td className="p-16-8">Advanced</td>
              </tr>
              <tr className="border-b">
                <td className="p-16-8 font-semi ink">Inventory Control</td>
                <td className="p-16-8">-</td>
                <td className="p-16-8">✓</td>
                <td className="p-16-8">✓</td>
              </tr>
              <tr className="border-b">
                <td className="p-16-8 font-semi ink">Whitelabel Path</td>
                <td className="p-16-8">-</td>
                <td className="p-16-8">Limited</td>
                <td className="p-16-8">Full Priority</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="text-center bg-brand-soft p-60 rounded-lg">
        <h2 className="mb-16">Frequently Asked Questions</h2>
        <p className="muted mb-32">Have more questions about our plans?</p>
        <a href="/help" className="button-secondary">Visit Help Center</a>
      </section>
    </main>
  );
}

