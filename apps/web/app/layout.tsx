import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import LogoutButton from "./LogoutButton";
import { apiGet, ApiError } from "./lib/api";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Utstyrsstyring",
  description: "Admin- og brukerflate for utstyrsstyring",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let me: { name: string; role: string } | null = null;
  try {
    me = await apiGet("/auth/me");
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
      throw error;
    }
  }

  return (
    <html lang="no">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <h1>Utstyrsstyring</h1>
            <nav>
              {me ? (
                <>
                  <Link href="/assets">Utstyr</Link>
                  <Link href="/scan">Skann</Link>
                  <Link href="/me">Min side</Link>
                  {me.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
                  {me.role === "ADMIN" ? <Link href="/admin/assets">Admin utstyr</Link> : null}
                  {me.role === "ADMIN" ? <Link href="/admin/users">Admin brukere</Link> : null}
                </>
              ) : (
                <Link href="/login">Logg inn</Link>
              )}
            </nav>
            <div className="row">
              {me ? <span className="muted">{me.name}</span> : null}
              {me ? <LogoutButton /> : null}
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
