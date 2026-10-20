import Link from "next/link";
import { getTrending } from "@/lib/data";
import { kindLabel } from "@/lib/labels";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function TrendingList() {
  const articles = await getTrending();

  return (
    <section className="border border-line bg-surface p-4" aria-labelledby="trending-heading">
      <SectionHeader id="trending-heading" title="Trending" />
      <ol className="space-y-4">
        {articles.map((article, index) => (
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
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
