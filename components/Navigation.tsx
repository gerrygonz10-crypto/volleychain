"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/six-degrees", label: "Six Degrees" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-court-700 bg-court-900/80 backdrop-blur-md">
      <nav className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-sand-100">
            Volley<span className="text-gold-400">Chain</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "text-gold-400 bg-court-700"
                  : "text-court-400 hover:text-sand-200 hover:bg-court-800"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
