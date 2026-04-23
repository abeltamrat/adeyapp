import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <strong>AdeyApp Control</strong>
            <nav className="menu">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/tenants">Tenants</Link>
              <Link href="/support">Support</Link>
              <Link href="/plans">Plans</Link>
              <Link href="/billing">Billing</Link>
              <Link href="/audit">Audit</Link>
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
