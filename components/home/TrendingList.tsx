import { Suspense } from "react";
import Link from "next/link";
import { getTrending } from "@/lib/data";
import { kindLabel } from "@/lib/labels";
import { EngagementCounts } from "@/components/engagement/EngagementCounts";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

export function TrendingList() {
  return (
    <section className="border border-line bg-surface p-4" aria-labelledby="trending-heading">
      <SectionHeader id="trending-heading" title="Trending" />
      <Suspense fallback={<p className="text-sm text-muted">Opening trending…</p>}>
        <TrendingContent />
      </Suspense>
    </section>
  );
}

async function TrendingContent() {
  const articles = await getTrending();
  const engagement = await engagementForSlugs(articles.map((article) => article.slug));

  return (
    <ol className="space-y-4">
      {articles.map((article, index) => {
        const counts = engagementFor(engagement, article.slug);
        return (
          <li key={article.id}>
            <Link href={`/articles/${article.slug}`} className="group grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
              <span className="font-display text-3xl font-extrabold leading-none text-accent">
                {index + 1}
              </span>
              <span>
                <span className="block font-display text-[11px] font-bold uppercase tracking-wider text-muted">
                  {kindLabel[article.kind]}
                </span>
                <span className="mt-0.5 block font-display text-base font-bold leading-tight group-hover:text-accent">
                  {article.headline}
                </span>
                <span className="mt-1 block">
                  <EngagementCounts likes={counts.likes} comments={counts.comments} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
