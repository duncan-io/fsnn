import type { Metadata } from "next";
import { Suspense } from "react";
import { getWeeklyRecaps } from "@/lib/data";
import { pageWidth } from "@/lib/labels";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { RecapColumn } from "@/components/recap/RecapColumn";

export const metadata: Metadata = {
  title: "Recaps",
  description: "Weekly league recaps from the FSNN newsroom.",
};

export default function RecapsPage() {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Week in Review
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Recaps</h1>
          <p className="mt-6 max-w-xl text-muted">Opening the week…</p>
        </main>
      }
    >
      <RecapsContent />
    </Suspense>
  );
}

async function RecapsContent() {
  const packages = await getWeeklyRecaps();

  return (
    <main className={`${pageWidth} py-8`}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
        Week in Review
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Recaps</h1>
      {packages.length === 0 ? (
        <p className="mt-6 max-w-xl text-muted">
          The Tuesday recap has not been filed. It lands after the week is final.
        </p>
      ) : (
        <div className="mt-8 space-y-12">
          {packages.map((item) => (
            <div key={item.column.id} className="space-y-8">
              <RecapColumn article={item.column} body={item.body} teams={item.teams} />
              {item.cards.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {item.cards.map((article) => (
                    <ArticleCard key={article.id} article={article} teams={item.teams} variant="md" />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
