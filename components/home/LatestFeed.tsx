import { Suspense } from "react";
import { io } from "next/cache";
import { getLatestArticles, getTeams } from "@/lib/data";
import type { Article } from "@/lib/types";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { breakingArticle } from "@/src/breaking/display";
import { listPublishedBreaking } from "@/src/breaking/store";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

const WEEK = 7 * 24 * 60 * 60 * 1000;

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
  const [fixtures, teams] = await Promise.all([getLatestArticles(), getTeams()]);
  const articles = [...fixtures, ...(await recentBreaking())].sort(byNewest);
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

async function recentBreaking(): Promise<Article[]> {
  if (!process.env.DATABASE_URL) return [];
  await io();
  try {
    const stories = await listPublishedBreaking({ since: new Date(Date.now() - WEEK), limit: 20 });
    return stories.map(breakingArticle);
  } catch {
    return [];
  }
}

function byNewest(a: Article, b: Article): number {
  return a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0;
}
