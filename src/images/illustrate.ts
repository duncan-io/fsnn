import { recapSlug } from "../recap/slug";
import type { RecapDraft, WeekBrief } from "../recap/types";
import { generateIllustration } from "../minimax/image";
import { putJpeg } from "../storage/bucket";
import { articleImageKey } from "./key";
import { setArticleImageKey, setOpinionImageKey, type StoredStory } from "./store";

export async function illustrateStored(story: StoredStory): Promise<boolean> {
  try {
    const imageKey = articleImageKey(story.slug);
    const bytes = await generateIllustration(story.headline, story.dek);
    await putJpeg(imageKey, bytes);
    if (story.kind === "article") await setArticleImageKey(story.slug, imageKey);
    else await setOpinionImageKey(story.slug, imageKey);
    console.log(`Illustrated ${story.slug}.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image failed.";
    console.error(`Image failed for ${story.slug}: ${message}`);
    return false;
  }
}

export async function illustrateRecap(brief: WeekBrief, draft: RecapDraft) {
  const stories: StoredStory[] = [
    {
      kind: "article",
      slug: recapSlug(brief.leagueKey, brief.week, null),
      headline: draft.column.headline,
      dek: draft.column.dek,
    },
    ...draft.cards.map((card) => ({
      kind: "article" as const,
      slug: recapSlug(brief.leagueKey, brief.week, card.matchupKey),
      headline: card.headline,
      dek: card.dek,
    })),
  ];
  for (const story of stories) {
    await illustrateStored(story);
  }
}
