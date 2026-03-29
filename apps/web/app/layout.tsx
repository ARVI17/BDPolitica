import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BDPolitica",
  description: "Gestion multi-tenant de campanas y listados"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="container">
          <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>BDPolitica</strong>
            <nav style={{ display: "flex", gap: 16 }}>
              <Link href="/">Inicio</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/login">Login</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
