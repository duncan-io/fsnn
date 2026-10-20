import Link from "next/link";
import type { Article, Team } from "@/lib/types";
import { lookupTeams } from "@/lib/format";
import { ArticleArt } from "@/components/ui/ArticleArt";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";

type ArticleCardProps = {
  article: Article;
  teams: Team[];
  variant: "lg" | "md" | "compact";
};

export function ArticleCard({ article, teams, variant }: ArticleCardProps) {
  const featured = lookupTeams(article.teamIds, teams);
  const href = `/articles/${article.slug}`;

  if (variant === "compact") {
    return (
      <Link href={href} className="group grid grid-cols-[112px_minmax(0,1fr)] gap-3">
        <div className="relative h-[84px]">
          <ArticleArt article={article} teams={featured} />
        </div>
        <div className="min-w-0">
          <KindBadge kind={article.kind} />
          <h3 className="mt-1 line-clamp-3 font-display text-base font-bold leading-tight group-hover:text-accent">
            {article.headline}
          </h3>
        </div>
      </Link>
    );
  }

  const large = variant === "lg";

  return (
    <Link href={href} className="group block">
      <div className={`relative ${large ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
        <ArticleArt article={article} teams={featured} />
        <div className="absolute left-3 top-3">
          <KindBadge kind={article.kind} />
        </div>
      </div>
      <h3
        className={`mt-3 font-display font-extrabold leading-tight tracking-tight group-hover:text-accent ${
          large ? "text-3xl" : "text-xl"
        }`}
      >
        {article.headline}
      </h3>
      <p className={`mt-2 text-muted ${large ? "text-base leading-6" : "line-clamp-2 text-sm leading-5"}`}>
        {article.dek}
      </p>
      <div className="mt-3">
        <ReporterByline
          reporter={article.reporter}
          publishedAt={article.publishedAt}
          readTimeMinutes={large ? article.readTimeMinutes : undefined}
          dense={!large}
        />
      </div>
    </Link>
  );
}
