import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdeyApp | One Calm System for Spa Operations",
  description: "Manage bookings, branches, staff attendance, and customer care from one connected platform built for real spa operations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="nav">
            <Link href="/" className="logo">
              <span>AdeyApp</span>
            </Link>
            <nav className="nav-links">
              <Link href="/features">Features</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/help">Help</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/login">Login</Link>
              <Link href="/signup" className="button">Get Started</Link>
            </nav>
          </header>
          {children}
        </div>
        <footer className="footer">
          <div className="shell">
            <div className="footer-grid">
              <div className="footer-brand">
                <Link href="/" className="logo">AdeyApp</Link>
                <p className="muted mt-16 max-w-300">
                  The operations platform for modern spa businesses. Built for scale, designed for calm.
                </p>
              </div>
              <div className="footer-links">
                <h4 className="mb-16">Product</h4>
                <div className="grid-gap-12">
                  <Link href="/features" className="muted">Features</Link>
                  <Link href="/pricing" className="muted">Pricing</Link>
                  <Link href="/help" className="muted">Help Center</Link>
                </div>
              </div>
              <div className="footer-links">
                <h4 className="mb-16">Company</h4>
                <div className="grid-gap-12">
                  <Link href="/contact" className="muted">Contact Us</Link>
                  <Link href="/about" className="muted">About</Link>
                  <Link href="/privacy" className="muted">Privacy Policy</Link>
                </div>
              </div>
              <div className="footer-links">
                <h4 className="mb-16">Connect</h4>
                <div className="grid-gap-12">
                  <a href="#" className="muted">Twitter</a>
                  <a href="#" className="muted">LinkedIn</a>
                  <a href="#" className="muted">Instagram</a>
                </div>
              </div>
            </div>
            <div className="mt-60 pt-24 border-t text-center">
              <p className="muted font-sm">
                © {new Date().getFullYear()} AdeyApp. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

