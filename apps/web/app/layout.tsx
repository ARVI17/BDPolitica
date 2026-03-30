import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { ReactNode } from "react";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "BDPolitica | Operación Electoral",
  description: "Plataforma profesional multi-tenant para operación de campaña."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={`${fontSans.variable} ${fontDisplay.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <h1 className="brand-mark">BDPolitica</h1>
              <p className="brand-sub">Operación territorial con control por roles</p>
            </div>
            <nav className="topnav">
              <Link className="nav-link" href="/">
                Inicio
              </Link>
              <Link className="nav-link" href="/dashboard">
                Dashboard
              </Link>
              <Link className="nav-link" href="/usuarios">
                Usuarios
              </Link>
              <Link className="nav-link" href="/login">
                Login
              </Link>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
