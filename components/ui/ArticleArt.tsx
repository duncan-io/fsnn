import type { Article, Team } from "@/lib/types";
import { BucketImage } from "@/components/ui/BucketImage";

type ArticleArtProps = {
  article: Article;
  teams: Team[];
  presentation?: "poster" | "backdrop";
  className?: string;
};

export function ArticleArt({
  article,
  teams,
  presentation = "poster",
  className,
}: ArticleArtProps) {
  const [home, away] = teams;
  const primary = home?.primaryColor ?? "#f5c518";
  const secondary = away?.primaryColor ?? home?.secondaryColor ?? "#1a1a1a";
  const mark = home?.abbreviation ?? "FSNN";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-surface ${className ?? ""}`}>
      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
        {article.imageUrl ? (
          <BucketImage src={article.imageUrl} />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(145deg, ${primary} 0%, ${secondary} 78%)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `repeating-linear-gradient(-18deg, transparent, transparent 12px, rgba(0,0,0,0.45) 12px, rgba(0,0,0,0.45) 14px)`,
              }}
            />
            {presentation === "poster" ? (
              <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
                <span className="font-display text-5xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-6xl">
                  {mark}
                </span>
                {away ? (
                  <>
                    <span className="font-display text-xl font-bold text-white/70">vs</span>
                    <span className="font-display text-5xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-6xl">
                      {away.abbreviation}
                    </span>
                  </>
                ) : null}
              </div>
            ) : (
              <span className="absolute -right-2 bottom-0 font-display text-[7rem] font-extrabold leading-none text-white/25 sm:text-[9rem]">
                {mark}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
