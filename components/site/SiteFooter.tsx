import Link from "next/link";
import { getLeague } from "@/lib/data";
import { pageWidth } from "@/lib/labels";
import { navLinks } from "@/lib/nav";

export async function SiteFooter() {
  const league = await getLeague();

  return (
    <footer className="mt-12 border-t border-line bg-black">
      <div className={`${pageWidth} grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <p className="font-display text-3xl font-extrabold tracking-wide">FSNN</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
            Weekly recaps, breaking news, and manager interviews from {league.name},{" "}
            {league.season}. Desk copy is produced by the FSNN newsroom from the league&apos;s
            results.
          </p>
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-accent">
            Coverage
          </h2>
          <ul className="mt-3 space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-foreground/80 hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-accent">
            League
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd>{league.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Season</dt>
              <dd>{league.season}</dd>
            </div>
            <div>
              <dt className="text-muted">Week</dt>
              <dd>{league.currentWeek}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-accent">
            Newsroom
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Six desks. One league. Stories land when the box score does — recaps, rankings,
            interviews, and the wire.
          </p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className={`${pageWidth} py-4 text-xs text-muted`}>
          © {league.season} Fantasy Sports News Network
        </p>
      </div>
    </footer>
  );
}
