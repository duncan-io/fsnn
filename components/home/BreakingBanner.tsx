import Link from "next/link";
import { getBreakingNews } from "@/lib/data";
import { pageWidth } from "@/lib/labels";

export async function BreakingBanner() {
  const [latest] = await getBreakingNews();
  if (!latest) return null;

  return (
    <div className="bg-breaking text-white">
      <div className={`${pageWidth} flex items-center gap-3 py-2`}>
        <span className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-extrabold uppercase tracking-[0.18em]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative size-2 rounded-full bg-white" />
          </span>
          Breaking
        </span>
        <Link
          href={`/articles/${latest.slug}`}
          className="truncate text-sm font-semibold hover:underline"
        >
          {latest.headline}
        </Link>
      </div>
    </div>
  );
}
