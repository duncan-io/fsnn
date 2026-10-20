import Link from "next/link";
import { getLeadStories, getLeague, getTeams } from "@/lib/data";
import { lookupTeams } from "@/lib/format";
import { ArticleArt } from "@/components/ui/ArticleArt";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";

export async function HeroLead() {
  const [stories, teams, league] = await Promise.all([
    getLeadStories(),
    getTeams(),
    getLeague(),
  ]);
  const [lead, ...secondary] = stories;

  if (!lead) {
    return (
      <h1 className="font-display text-5xl font-extrabold uppercase">
        Fantasy Sports News Network
      </h1>
    );
  }

  const leadTeams = lookupTeams(lead.teamIds, teams);

  return (
    <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      <Link
        href={`/articles/${lead.slug}`}
        className="group relative min-h-[440px] overflow-hidden lg:col-span-2 lg:min-h-[560px]"
      >
        <ArticleArt article={lead} teams={leadTeams} presentation="backdrop" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Week {league.currentWeek} · {league.name}
          </p>
          <div className="mt-3">
            <KindBadge kind={lead.kind} />
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold uppercase leading-[0.92] tracking-tight group-hover:text-accent sm:text-5xl lg:text-6xl">
            {lead.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">{lead.dek}</p>
          <div className="mt-4">
            <ReporterByline
              reporter={lead.reporter}
              publishedAt={lead.publishedAt}
              readTimeMinutes={lead.readTimeMinutes}
              tone="inverse"
            />
          </div>
        </div>
      </Link>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-4">
        {secondary.map((article) => {
          const featured = lookupTeams(article.teamIds, teams);
          return (
            <Link
              key={article.id}
              href={`/articles/${article.slug}`}
              className="group relative min-h-[150px] flex-1 overflow-hidden"
            >
              <ArticleArt article={article} teams={featured} presentation="backdrop" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <KindBadge kind={article.kind} />
                <p className="mt-1.5 line-clamp-3 font-display text-lg font-extrabold leading-tight group-hover:text-accent">
                  {article.headline}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
