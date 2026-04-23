import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdeyApp",
  description: "Multi-tenant spa management platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="nav">
            <Link href="/">
              <strong>AdeyApp</strong>
            </Link>
            <nav className="nav-links">
              <Link href="/features">Features</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/help">Help</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/login">Login</Link>
              <Link href="/signup">Sign up</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
