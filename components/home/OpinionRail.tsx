import Link from "next/link";
import { io } from "next/cache";
import { EngagementCounts } from "@/components/engagement/EngagementCounts";
import { BucketImage } from "@/components/ui/BucketImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatAbsoluteTime } from "@/lib/format";
import { listPublishedOpinions } from "@/src/opinion/store";
import { engagementFor, engagementForSlugs } from "@/src/readers/store";

export async function OpinionRail() {
  await io();
  if (!process.env.DATABASE_URL) return null;
  let columns;
  try {
    columns = await listPublishedOpinions(2);
  } catch {
    return null;
  }
  if (columns.length === 0) return null;
  const engagement = await engagementForSlugs(columns.map((column) => column.slug));

  return (
    <section aria-labelledby="opinion-heading">
      <SectionHeader id="opinion-heading" title="Opinion" />
      <div className="grid gap-6 md:grid-cols-2">
        {columns.map((column) => (
          <Link
            key={column.id}
            href={`/articles/${column.slug}`}
            className="group block overflow-hidden border border-line bg-surface"
          >
            {column.imageUrl ? (
              <div className="relative aspect-[16/9]">
                <BucketImage src={column.imageUrl} />
              </div>
            ) : null}
            <div className="p-5">
              <p className="font-display text-xs font-bold uppercase tracking-wider text-accent">
                Week {column.week} · {column.desk === "waivers" ? "Waivers" : "Results"}
              </p>
              <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight group-hover:text-accent">
                {column.headline}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{column.dek}</p>
              <p className="mt-4 text-xs text-muted">
                {column.columnistName}
                {column.publishedAt ? ` · ${formatAbsoluteTime(column.publishedAt.toISOString())}` : ""}
              </p>
              <div className="mt-2">
                <EngagementCounts
                  likes={engagementFor(engagement, column.slug).likes}
                  comments={engagementFor(engagement, column.slug).comments}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
