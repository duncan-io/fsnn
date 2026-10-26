"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/nav";

export function SiteNav({ className }: { className?: string }) {
  return (
    <Suspense fallback={<NavLinks className={className} pathname={null} />}>
      <ActiveNav className={className} />
    </Suspense>
  );
}

function ActiveNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return <NavLinks className={className} pathname={pathname} />;
}

function NavLinks({ className, pathname }: { className?: string; pathname: string | null }) {
  return (
    <nav className={className} aria-label="Sections">
      {navLinks.map((link) => {
        const active = pathname
          ? link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href)
          : false;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 font-display text-sm font-bold uppercase tracking-wide ${
              active ? "text-accent" : "text-foreground/75 hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
