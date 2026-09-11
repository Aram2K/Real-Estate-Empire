import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDF Investment Radar",
  description:
    "Map, score and stress-test rental-investment opportunities across Île-de-France.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/map", label: "Map" },
  { href: "/properties", label: "Deals" },
  { href: "/deal-finder", label: "Deal Finder" },
  { href: "/import", label: "Import" },
  { href: "/saved", label: "Saved" },
  { href: "/settings", label: "Assumptions" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-white">
                  ◎
                </span>
                <span>IDF Investment Radar</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
            Estimates only — not guaranteed investment returns. Built on DVF,
            Carte des Loyers, INSEE & Île-de-France Mobilités open data. Grand
            Paris Express dates are SGP estimates, subject to change.
          </footer>
        </div>
      </body>
    </html>
  );
}
