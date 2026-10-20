import { getCurrentMatchups, getLeague, getTeams } from "@/lib/data";
import { formatPoints } from "@/lib/format";
import { pageWidth } from "@/lib/labels";
import type { Matchup, MatchupStatus, Team } from "@/lib/types";

function teamScoreClass(score: number, other: number, status: MatchupStatus): string {
  if (status !== "final") return "text-foreground";
  return score >= other ? "text-foreground" : "text-muted";
}

function MatchupChip({ matchup, teams }: { matchup: Matchup; teams: Map<string, Team> }) {
  const home = teams.get(matchup.homeTeamId);
  const away = teams.get(matchup.awayTeamId);
  if (!home || !away) return null;

  const upcoming = matchup.status === "upcoming";

  return (
    <article className="flex w-[168px] shrink-0 flex-col justify-center border-l border-line px-3 py-2">
      <TeamLine
        team={home}
        score={upcoming ? null : formatPoints(matchup.homeScore)}
        className={teamScoreClass(matchup.homeScore, matchup.awayScore, matchup.status)}
      />
      <TeamLine
        team={away}
        score={upcoming ? null : formatPoints(matchup.awayScore)}
        className={teamScoreClass(matchup.awayScore, matchup.homeScore, matchup.status)}
      />
      <Status status={matchup.status} kickoffLabel={matchup.kickoffLabel} />
    </article>
  );
}

function TeamLine({
  team,
  score,
  className,
}: {
  team: Team;
  score: string | null;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0" style={{ backgroundColor: team.primaryColor }} aria-hidden="true" />
      <span className="w-8 font-display text-sm font-bold">{team.abbreviation}</span>
      <span className={`ml-auto font-display text-sm font-bold tabular-nums ${className}`}>
        {score ?? "–"}
      </span>
    </div>
  );
}

function Status({ status, kickoffLabel }: { status: MatchupStatus; kickoffLabel?: string }) {
  if (status === "live") {
    return (
      <p className="mt-1 flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-breaking">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-breaking opacity-75" />
          <span className="relative size-1.5 rounded-full bg-breaking" />
        </span>
        Live
      </p>
    );
  }

  if (status === "upcoming") {
    return (
      <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-wider text-muted">
        {kickoffLabel ?? "Upcoming"}
      </p>
    );
  }

  return (
    <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-wider text-muted">Final</p>
  );
}

export async function ScoreTicker() {
  const [league, matchups, teams] = await Promise.all([
    getLeague(),
    getCurrentMatchups(),
    getTeams(),
  ]);
  const byId = new Map(teams.map((team) => [team.id, team]));

  return (
    <section className="border-b border-line bg-surface" aria-label={`Week ${league.currentWeek} scores`}>
      <div className={`${pageWidth} flex items-stretch`}>
        <div className="flex shrink-0 flex-col justify-center pr-4">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            Scores
          </p>
          <p className="font-display text-lg font-extrabold uppercase leading-none">
            Week {league.currentWeek}
          </p>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="no-scrollbar flex overflow-x-auto">
            {matchups.map((matchup) => (
              <MatchupChip key={matchup.id} matchup={matchup} teams={byId} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent" />
        </div>
      </div>
    </section>
  );
}
