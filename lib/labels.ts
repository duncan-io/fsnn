import type { ArticleKind } from "@/lib/types";

export const kindLabel: Record<ArticleKind, string> = {
  "weekly-recap": "Recap",
  breaking: "Breaking",
  interview: "Interview",
  "power-rankings": "Rankings",
  preview: "Preview",
  analysis: "Analysis",
};

export const pageWidth = "mx-auto w-full max-w-[1200px] px-4";
