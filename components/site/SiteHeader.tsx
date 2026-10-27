import { Suspense } from "react";
import Link from "next/link";
import { getLeague } from "@/lib/data";
import { pageWidth } from "@/lib/labels";
import { ReaderMenu } from "@/components/site/ReaderMenu";
import { SiteNav } from "@/components/site/SiteNav";

function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center">
      <img
        src="/logo.png"
        alt="FSNN — Fantasy Sports News Network"
        width={835}
        height={220}
        className="h-10 w-auto"
      />
    </Link>
  );
}

function SearchMark() {
  return (
    <span className="grid size-9 place-items-center text-foreground" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16.5 20 20.5" strokeLinecap="square" />
      </svg>
    </span>
  );
}

export async function SiteHeader() {
  const league = await getLeague();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-black/95 backdrop-blur">
      <div className="h-1 bg-accent" />
      <div className={`${pageWidth} flex h-16 items-center gap-6`}>
        <Wordmark />
        <SiteNav className="hidden items-center gap-5 lg:flex" />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/standings"
            className="hidden border border-line px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-foreground/90 hover:border-accent hover:text-accent sm:inline-flex"
          >
            {league.name}
            <span className="mx-1.5 text-muted">·</span>
            Wk {league.currentWeek}
          </Link>
          <Suspense
            fallback={
              <span className="font-display text-xs font-bold uppercase tracking-wide text-muted">Sign in</span>
            }
          >
            <ReaderMenu />
          </Suspense>
          <SearchMark />
        </div>
      </div>
      <div className="border-t border-line lg:hidden">
        <SiteNav
          mobile
          className={`${pageWidth} no-scrollbar flex gap-5 overflow-x-auto py-2.5`}
        />
      </div>
    </header>
  );
}
