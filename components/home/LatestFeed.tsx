import { getLatestArticles, getTeams } from "@/lib/data";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function LatestFeed() {
  const [articles, teams] = await Promise.all([getLatestArticles(), getTeams()]);
  const [lead, ...rest] = articles;
  const mids = rest.slice(0, 2);
  const compact = rest.slice(2);

  return (
    <section aria-labelledby="latest-heading">
      <SectionHeader id="latest-heading" title="Latest" />
      <div className="flex flex-col gap-8">
        {lead ? <ArticleCard article={lead} teams={teams} variant="lg" /> : null}
        {mids.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {mids.map((article) => (
              <ArticleCard key={article.id} article={article} teams={teams} variant="md" />
            ))}
          </div>
        ) : null}
        {compact.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {compact.map((article) => (
              <li key={article.id} className="py-4">
                <ArticleCard article={article} teams={teams} variant="compact" />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
