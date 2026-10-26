import { Suspense } from "react";
import { getWeeklyRecaps } from "@/lib/data";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

export function WeeklyRecapRail() {
  return (
    <Suspense fallback={<RecapRailFallback />}>
      <WeeklyRecapContent />
    </Suspense>
  );
}

function RecapRailFallback() {
  return (
    <section aria-labelledby="recap-heading" aria-busy="true">
      <SectionHeader id="recap-heading" title="Weekly recaps" href="/recaps" />
      <p className="text-sm text-muted">Opening the week…</p>
    </section>
  );
}

async function WeeklyRecapContent() {
  const packages = await getWeeklyRecaps();
  const week = packages[0]?.week;
  const cards = packages.flatMap((item) =>
    item.cards.map((article) => ({ article, teams: item.teams })),
  );
  const engagement = await engagementForSlugs(cards.map(({ article }) => article.slug));

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
              <ArticleCard
                article={article}
                teams={teams}
                variant="md"
                engagement={engagementFor(engagement, article.slug)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
