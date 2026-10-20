import { getWeeklyRecaps } from "@/lib/data";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function WeeklyRecapRail() {
  const packages = await getWeeklyRecaps();
  const week = packages[0]?.week;
  const cards = packages.flatMap((item) =>
    item.cards.map((article) => ({ article, teams: item.teams })),
  );

  return (
    <section aria-labelledby="recap-heading">
      <SectionHeader
        id="recap-heading"
        title={week ? `Week ${week} recaps` : "Weekly recaps"}
        href="/recaps"
      />
      {cards.length === 0 ? (
        <p className="text-sm text-muted">The Tuesday recap has not been filed.</p>
      ) : (
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1">
          {cards.map(({ article, teams }) => (
            <div key={article.id} className="w-[280px] shrink-0 snap-start">
              <ArticleCard article={article} teams={teams} variant="md" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
