import type { Article } from "@/lib/types";
import type { BreakingStory } from "./store";

export function breakingArticle(story: BreakingStory): Article {
  const words = story.body.trim().split(/\s+/).filter(Boolean).length;
  return {
    id: story.id,
    slug: story.slug,
    kind: "breaking",
    headline: story.headline,
    dek: story.dek,
    teamIds: story.teamKeys,
    reporter: {
      name: story.reporterName,
      beat: story.reporterBeat,
      initials: story.reporterInitials,
    },
    publishedAt: story.publishedAt.toISOString(),
    readTimeMinutes: Math.max(1, Math.round(words / 220)),
    tags: [],
    imageUrl: story.imageUrl,
  };
}
