import { Suspense } from "react";
import { getLatestArticles, getTeams } from "@/lib/data";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

export function LatestFeed() {
  return (
    <section aria-labelledby="latest-heading">
      <SectionHeader id="latest-heading" title="Latest" />
      <Suspense fallback={<p className="text-sm text-muted">Opening the latest…</p>}>
        <LatestFeedContent />
      </Suspense>
    </section>
  );
}

async function LatestFeedContent() {
  const [articles, teams] = await Promise.all([getLatestArticles(), getTeams()]);
  const engagement = await engagementForSlugs(articles.map((article) => article.slug));
  const [lead, ...rest] = articles;
  const mids = rest.slice(0, 2);
  const compact = rest.slice(2);

  return (
    <div className="flex flex-col gap-8">
      {lead ? (
        <ArticleCard
          article={lead}
          teams={teams}
          variant="lg"
          engagement={engagementFor(engagement, lead.slug)}
        />
      ) : null}
      {mids.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {mids.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              teams={teams}
              variant="md"
              engagement={engagementFor(engagement, article.slug)}
            />
          ))}
        </div>
      ) : null}
      {compact.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {compact.map((article) => (
            <li key={article.id} className="py-4">
              <ArticleCard
                article={article}
                teams={teams}
                variant="compact"
                engagement={engagementFor(engagement, article.slug)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
