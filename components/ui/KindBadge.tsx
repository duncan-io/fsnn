import type { ArticleKind } from "@/lib/types";
import { kindLabel } from "@/lib/labels";

const tone: Record<ArticleKind, string> = {
  breaking: "bg-breaking text-white",
  "weekly-recap": "bg-accent text-black",
  interview: "bg-white text-black",
  "power-rankings": "bg-accent text-black",
  preview: "bg-foreground text-black",
  analysis: "bg-accent text-black",
};

export function KindBadge({ kind }: { kind: ArticleKind }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${tone[kind]}`}
    >
      {kindLabel[kind]}
    </span>
  );
}
