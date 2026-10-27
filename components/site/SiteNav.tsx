"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageWidth } from "@/lib/labels";
import { headerNav, isNavGroup, newsLinks, type NavLink } from "@/lib/nav";

export function SiteNav({ className, mobile = false }: { className?: string; mobile?: boolean }) {
  return (
    <Suspense fallback={<NavLinks className={className} mobile={mobile} pathname={null} />}>
      <ActiveNav className={className} mobile={mobile} />
    </Suspense>
  );
}

function ActiveNav({ className, mobile }: { className?: string; mobile: boolean }) {
  const pathname = usePathname();
  return <NavLinks className={className} mobile={mobile} pathname={pathname} />;
}

function NavLinks({
  className,
  mobile,
  pathname,
}: {
  className?: string;
  mobile: boolean;
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const menuId = useId();
  const newsActive = newsLinks.some((link) => isCurrent(pathname, link.href));

  function closeMenu() {
    pinned.current = false;
    setOpen(false);
  }

  useEffect(() => {
    pinned.current = false;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const nav = document.getElementById(menuId)?.closest("nav");
      if (!nav?.contains(event.target as Node)) closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId, open]);

  const items = headerNav.map((entry) => {
    if (isNavGroup(entry)) {
      return (
        <NewsMenu
          key={entry.label}
          menuId={menuId}
          mobile={mobile}
          open={open}
          active={newsActive}
          pathname={pathname}
          pinned={pinned}
          onOpenChange={setOpen}
          onClose={closeMenu}
        />
      );
    }

    return <NavItem key={entry.href} link={entry} pathname={pathname} />;
  });

  if (!mobile) {
    return (
      <nav className={className} aria-label="Sections">
        {items}
      </nav>
    );
  }

  return (
    <nav aria-label="Sections">
      <div className={className}>{items}</div>
      <div
        id={menuId}
        className={`${pageWidth} gap-5 overflow-x-auto border-t border-line py-2.5 ${open ? "flex" : "hidden"}`}
      >
        {newsLinks.map((link) => (
          <NavItem key={link.href} link={link} pathname={pathname} onNavigate={closeMenu} />
        ))}
      </div>
    </nav>
  );
}

function NewsMenu({
  menuId,
  mobile,
  open,
  active,
  pathname,
  pinned,
  onOpenChange,
  onClose,
}: {
  menuId: string;
  mobile: boolean;
  open: boolean;
  active: boolean;
  pathname: string | null;
  pinned: { current: boolean };
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => {
        if (!mobile) onOpenChange(true);
      }}
      onMouseLeave={(event) => {
        if (mobile || pinned.current) return;
        if (event.currentTarget.contains(document.activeElement)) return;
        onOpenChange(false);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (!mobile && event.currentTarget.matches(":hover")) return;
        onClose();
      }}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${itemClass(active)}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (!open) {
            pinned.current = true;
            onOpenChange(true);
            return;
          }
          if (!pinned.current) {
            pinned.current = true;
            return;
          }
          onClose();
        }}
      >
        News
        <Caret open={open} />
      </button>
      {mobile ? null : (
        <div className={`absolute left-0 top-full z-50 pt-6 ${open ? "block" : "hidden"}`}>
          <ul id={menuId} className="min-w-48 border border-line border-t-2 border-t-accent bg-black py-1">
            {newsLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                  onClick={onClose}
                  className={`block whitespace-nowrap px-4 py-2 font-display text-sm font-bold uppercase tracking-wide ${
                    isCurrent(pathname, link.href)
                      ? "text-accent"
                      : "text-foreground/75 hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NavItem({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const active = isCurrent(pathname, link.href);

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={itemClass(active)}
    >
      {link.label}
    </Link>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`size-3 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2.25 4.5 6 8.25 9.75 4.5" />
    </svg>
  );
}

function itemClass(active: boolean) {
  return `shrink-0 font-display text-sm font-bold uppercase tracking-wide ${
    active ? "text-accent" : "text-foreground/75 hover:text-foreground"
  }`;
}

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
