import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RankingsColumn } from "@/components/rankings/RankingsColumn";
import { getPowerRankings } from "@/lib/data/rankings";
import { pageWidth } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Power rankings",
  description: "Weekly power rankings ordered by scoring, roster strength, and schedule.",
};

export default function PowerRankingsPage() {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Power Rankings
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Power rankings</h1>
          <p className="mt-6 max-w-xl text-muted">Opening the rankings…</p>
        </main>
      }
    >
      <PowerRankingsContent />
    </Suspense>
  );
}

async function PowerRankingsContent() {
  const rankings = await getPowerRankings();
  const latest = rankings[0];

  return (
    <main className={`${pageWidth} py-8`}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
        Power Rankings
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Power rankings</h1>
      {latest == null ? (
        <p className="mt-6 max-w-xl text-muted">
          The Wednesday rankings have not been filed. They land after the week is final.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          <ul className="max-w-2xl space-y-2">
            {rankings.map((ranking) => (
              <li key={ranking.article.id}>
                <Link
                  href={`/articles/${ranking.article.slug}`}
                  className="font-display text-sm font-bold uppercase tracking-wider text-accent"
                >
                  Week {ranking.brief.week}: {ranking.article.headline}
                </Link>
              </li>
            ))}
          </ul>
          <RankingsColumn article={latest.article} body={latest.body} brief={latest.brief} />
        </div>
      )}
    </main>
  );
}
