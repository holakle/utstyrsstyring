import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <h1>Utstyrsstyring</h1>
            <nav>
              <Link href="/assets">Utstyr</Link>
              <Link href="/me">Min side</Link>
              <Link href="/admin">Admin</Link>
              <Link href="/admin/assets">Admin utstyr</Link>
              <Link href="/admin/users">Admin brukere</Link>
            </nav>
          </header>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
