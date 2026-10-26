import type { Article } from "@/lib/types";
import type { RankingsBody, RankingsBrief, RankingsTeamFact } from "@/src/rankings/types";
import { ArticleLead } from "@/components/ui/ArticleLead";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";

type RankingsColumnProps = {
  article: Article;
  body: RankingsBody;
  brief: RankingsBrief;
};

export function RankingsColumn({ article, body, brief }: RankingsColumnProps) {
  const paragraphs = new Map(body.entries.map((entry) => [entry.teamKey, entry.paragraphs]));

  return (
    <article>
      <ArticleLead src={article.imageUrl} />
      <KindBadge kind={article.kind} />
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
        {article.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted">{article.dek}</p>
      <div className="mt-4">
        <ReporterByline
          reporter={article.reporter}
          publishedAt={article.publishedAt}
          readTimeMinutes={article.readTimeMinutes}
        />
      </div>
      <p className="mt-8 max-w-2xl text-base leading-7">{body.lede}</p>
      <ol className="mt-8 max-w-2xl">
        {brief.teams.map((team) => (
          <li key={team.teamKey} className="border-t border-line py-6">
            <div className="flex items-start justify-between gap-4">
              <p className="font-display text-5xl font-extrabold leading-none text-accent">{team.rank}</p>
              <Movement delta={team.previousRank - team.rank} />
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">{team.teamName}</h2>
            <p className="mt-1 text-sm text-muted">
              {team.managerName ?? "Manager"}
              {team.streak ? ` · ${team.streak}` : ""}
            </p>
            <p className="mt-3 text-sm font-medium">{summary(team)}</p>
            <p className="mt-1 text-sm text-muted">{details(team)}</p>
            {team.note ? <p className="mt-3 text-sm text-muted">{team.note}</p> : null}
            <div className="mt-3 space-y-4 text-base leading-7">
              {(paragraphs.get(team.teamKey) ?? []).map((paragraph, index) => (
                <p key={`${team.teamKey}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {body.kicker ? <p className="max-w-2xl border-t border-line pt-6 leading-7">{body.kicker}</p> : null}
    </article>
  );
}

function summary(team: RankingsTeamFact): string {
  const record = team.ties > 0 ? `${team.wins}-${team.losses}-${team.ties}` : `${team.wins}-${team.losses}`;
  const allPlay =
    team.allPlayTies > 0
      ? `${team.allPlayWins}-${team.allPlayLosses}-${team.allPlayTies}`
      : `${team.allPlayWins}-${team.allPlayLosses}`;
  const parts = [record, `${formatStat(team.pointsPerGame)} per game`, `all-play ${allPlay}`];
  if (team.yahooRank != null) parts.push(`Yahoo rank ${team.yahooRank}`);
  return parts.join(" · ");
}

function details(team: RankingsTeamFact): string {
  const parts = [
    `${formatStat(team.pointsFor)} scored`,
    `${formatStat(team.pointsAgainst)} allowed`,
  ];
  if (team.recentPointsPerGame != null) parts.push(`${formatStat(team.recentPointsPerGame)} over the last three`);
  if (team.starterSeasonPoints != null) parts.push(`starters ${formatStat(team.starterSeasonPoints)}`);
  if (team.projectionGap != null) parts.push(`projection ${formatSigned(team.projectionGap)}`);
  if (team.pastOpponentPointsPerGame != null) {
    parts.push(`past opponents ${formatStat(team.pastOpponentPointsPerGame)}`);
  }
  if (team.remainingOpponentPointsPerGame != null) {
    parts.push(`remaining opponents ${formatStat(team.remainingOpponentPointsPerGame)}`);
  }
  return parts.join(" · ");
}

function formatStat(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, "");
}

function formatSigned(value: number): string {
  const text = formatStat(value);
  return value > 0 ? `+${text}` : text;
}

function Movement({ delta }: { delta: number }) {
  if (delta === 0) return <span className="font-display text-sm font-bold text-muted">—</span>;
  const up = delta > 0;
  return (
    <span className={`font-display text-sm font-bold ${up ? "text-up" : "text-down"}`}>
      {up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}
    </span>
  );
}
