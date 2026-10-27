import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { getTeams } from "@/lib/data";
import { pageWidth } from "@/lib/labels";
import { breakingArticle } from "@/src/breaking/display";
import { listPublishedBreaking } from "@/src/breaking/store";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

export const metadata: Metadata = {
  title: "Breaking",
  description: "Trades, waiver bids, and starter injuries from the FSNN wire.",
};

export default function BreakingPage() {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-breaking">Wire</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Breaking</h1>
          <p className="mt-6 max-w-xl text-muted">Opening the wire…</p>
        </main>
      }
    >
      <BreakingContent />
    </Suspense>
  );
}

async function BreakingContent() {
  const stories = await publishedBreaking();
  const teams = await getTeams();
  const articles = stories.map(breakingArticle);
  const engagement = await engagementForSlugs(articles.map((article) => article.slug));

  return (
    <main className={`${pageWidth} py-8`}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-breaking">Wire</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Breaking</h1>
      {articles.length === 0 ? (
        <p className="mt-6 max-w-xl text-muted">Nothing is on the wire.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              teams={teams}
              variant="md"
              engagement={engagementFor(engagement, article.slug)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

async function publishedBreaking() {
  if (!process.env.DATABASE_URL) return [];
  await io();
  try {
    return await listPublishedBreaking({ limit: 40 });
  } catch {
    return [];
  }
}
