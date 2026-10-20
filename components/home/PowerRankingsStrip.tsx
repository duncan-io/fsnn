import { getStandings } from "@/lib/data";
import { formatRecord } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Team } from "@/lib/types";

function Movement({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="font-display text-sm font-bold text-muted">—</span>;
  }

  const up = delta > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-display text-sm font-bold ${
        up ? "text-up" : "text-down"
      }`}
    >
      <svg viewBox="0 0 12 12" className={`size-3 ${up ? "" : "rotate-180"}`} aria-hidden="true">
        <path d="M6 2.5 10.5 8.5H1.5L6 2.5Z" fill="currentColor" />
      </svg>
      {Math.abs(delta)}
      <span className="sr-only">{up ? "spots up" : "spots down"}</span>
    </span>
  );
}

function RankCard({ team }: { team: Team }) {
  return (
    <li className="border border-line bg-surface">
      <div className="h-1" style={{ backgroundColor: team.primaryColor }} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <span className="font-display text-5xl font-extrabold leading-none text-accent">
            {team.rank}
          </span>
          <Movement delta={team.previousRank - team.rank} />
        </div>
        <p className="mt-3 font-display text-xl font-extrabold uppercase leading-none">{team.abbreviation}</p>
        <p className="mt-1 text-sm font-medium">{team.name}</p>
        <p className="mt-2 text-xs text-muted">
          {team.managerName} · {formatRecord(team)} · {team.streak}
        </p>
      </div>
    </li>
  );
}

export async function PowerRankingsStrip() {
  const standings = await getStandings();
  const top = standings.slice(0, 5);

  return (
    <section aria-labelledby="rankings-heading">
      <SectionHeader id="rankings-heading" title="Power rankings" href="/power-rankings" />
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {top.map((team) => (
          <RankCard key={team.id} team={team} />
        ))}
      </ol>
    </section>
  );
}
