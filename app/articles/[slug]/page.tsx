import type { Metadata } from "next";
import Link from "next/link";
import { io } from "next/cache";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { articles } from "@/lib/data/fixtures";
import { getFixtureArticle, getStoredRanking, getStoredRecap } from "@/lib/data";
import { formatPoints } from "@/lib/format";
import { pageWidth } from "@/lib/labels";
import { ArticleEngagement } from "@/components/engagement/ArticleEngagement";
import { BreakingStoryView } from "@/components/breaking/BreakingStory";
import { RankingsColumn } from "@/components/rankings/RankingsColumn";
import { ArticleLead } from "@/components/ui/ArticleLead";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";
import { RecapColumn } from "@/components/recap/RecapColumn";
import type { StoredRecap } from "@/lib/data/recaps";
import { OpinionStory } from "@/components/opinion/OpinionStory";
import { getPublishedBreaking } from "@/src/breaking/store";
import { getPublishedOpinion } from "@/src/opinion/store";
import { matchupAnchor } from "@/src/recap/slug";

function isOpinionSlug(slug: string) {
  return slug.endsWith("-results") || slug.endsWith("-waivers");
}

async function publishedBreaking(slug: string) {
  if (!process.env.DATABASE_URL) return null;
  await io();
  try {
    return await getPublishedBreaking(slug);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug.includes("power-rankings")) {
    const ranking = await getStoredRanking(slug);
    if (ranking) return { title: ranking.article.headline, description: ranking.article.dek };
  }
  const stored = await getStoredRecap(slug);
  if (stored) return { title: stored.article.headline };
  if (isOpinionSlug(slug) && process.env.DATABASE_URL) {
    await io();
    const column = await getPublishedOpinion(slug);
    if (column) return { title: column.headline, description: column.dek };
  }
  const story = await publishedBreaking(slug);
  if (story) return { title: story.headline, description: story.dek };
  const fixture = await getFixtureArticle(slug);
  if (fixture) return { title: fixture.article.headline };
  return { title: "Story" };
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className={`${pageWidth} py-10 text-muted`}>Opening the story…</p>}>
      <Story params={params} />
    </Suspense>
  );
}

async function Story({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.includes("power-rankings")) {
    const ranking = await getStoredRanking(slug);
    if (ranking) {
      return (
        <main className={`${pageWidth} py-8`}>
          <RankingsColumn article={ranking.article} body={ranking.body} brief={ranking.brief} />
        </main>
      );
    }
  }
  const stored = await getStoredRecap(slug);
  if (stored) return <StoredStory recap={stored} />;
  if (isOpinionSlug(slug) && process.env.DATABASE_URL) {
    await io();
    const column = await getPublishedOpinion(slug);
    if (column) return <OpinionStory column={column} />;
  }
  const story = await publishedBreaking(slug);
  if (story) return <BreakingStoryView story={story} />;
  const fixture = await getFixtureArticle(slug);
  if (!fixture) notFound();

  return (
    <main className={`${pageWidth} py-8`}>
      <article className="max-w-2xl">
        <KindBadge kind={fixture.article.kind} />
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          {fixture.article.headline}
        </h1>
        <p className="mt-4 text-lg leading-7 text-muted">{fixture.article.dek}</p>
        <div className="mt-4">
          <ReporterByline
            reporter={fixture.article.reporter}
            publishedAt={fixture.article.publishedAt}
            readTimeMinutes={fixture.article.readTimeMinutes}
          />
        </div>
        <ArticleEngagement slug={fixture.article.slug} />
      </article>
    </main>
  );
}

function StoredStory({ recap }: { recap: StoredRecap }) {
  if (recap.scope === "league" && recap.body) {
    return (
      <main className={`${pageWidth} py-8`}>
        <RecapColumn article={recap.article} body={recap.body} teams={recap.teams} />
      </main>
    );
  }

  const matchup = recap.brief.matchups.find(
    (item) => recap.matchupAnchorId === matchupAnchor(item.matchupKey),
  );
  const columnHref = recap.matchupAnchorId
    ? `/articles/${recap.columnSlug}#${recap.matchupAnchorId}`
    : `/articles/${recap.columnSlug}`;

  return (
    <main className={`${pageWidth} py-8`}>
      <article className="max-w-2xl">
        <ArticleLead src={recap.article.imageUrl} />
        <KindBadge kind={recap.article.kind} />
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          {recap.article.headline}
        </h1>
        <p className="mt-4 text-lg leading-7 text-muted">{recap.article.dek}</p>
        {matchup ? (
          <p className="mt-6 font-display text-2xl font-bold tracking-tight">
            {matchup.winner.teamName} {formatPoints(matchup.winner.points)}
            <span className="mx-2 text-muted">{matchup.result === "tie" ? "tied" : "–"}</span>
            {matchup.loser.teamName} {formatPoints(matchup.loser.points)}
          </p>
        ) : null}
        <div className="mt-4">
          <ReporterByline
            reporter={recap.article.reporter}
            publishedAt={recap.article.publishedAt}
            readTimeMinutes={recap.article.readTimeMinutes}
          />
        </div>
        <p className="mt-8">
          <Link href={columnHref} className="font-display text-sm font-bold uppercase tracking-wider text-accent">
            Read the full week
          </Link>
        </p>
        <ArticleEngagement slug={recap.article.slug} />
      </article>
    </main>
  );
}
