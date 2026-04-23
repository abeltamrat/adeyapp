export default function PricingPage() {
  return (
    <main className="grid">
      <section className="section-card">
        <p className="eyebrow">Starter</p>
        <h1 className="page-title">For single-branch spas</h1>
        <p className="muted">Core bookings, staff, attendance, and customer history.</p>
      </section>
      <section className="section-card">
        <p className="eyebrow">Growth</p>
        <h1 className="page-title">For growing workspaces</h1>
        <p className="muted">Multi-branch operations, richer reporting, and upgraded controls.</p>
      </section>
      <section className="section-card">
        <p className="eyebrow">Enterprise</p>
        <h1 className="page-title">For advanced operators</h1>
        <p className="muted">Quotas, custom branding, advanced governance, and premium support.</p>
      </section>
    </main>
  );
}
