import { getArticlesByKind, getLeague, getTeams } from "@/lib/data";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function WeeklyRecapRail() {
  const [recaps, teams, league] = await Promise.all([
    getArticlesByKind("weekly-recap"),
    getTeams(),
    getLeague(),
  ]);

  return (
    <section aria-labelledby="recap-heading">
      <SectionHeader
        id="recap-heading"
        title={`Week ${league.currentWeek} recaps`}
        href="/recaps"
      />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1">
        {recaps.map((article) => (
          <div key={article.id} className="w-[280px] shrink-0 snap-start">
            <ArticleCard article={article} teams={teams} variant="md" />
          </div>
        ))}
      </div>
    </section>
  );
}
