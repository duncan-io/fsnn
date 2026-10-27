import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { articles, breakingItems, opinionColumns } from "../db/schema";

export type StoredStory = {
  kind: "article" | "opinion" | "breaking";
  slug: string;
  headline: string;
  dek: string;
};

export async function setArticleImageKey(slug: string, imageKey: string) {
  const db = getDb();
  await db.update(articles).set({ imageKey, updatedAt: new Date() }).where(eq(articles.slug, slug));
}

export async function setOpinionImageKey(slug: string, imageKey: string) {
  const db = getDb();
  await db.update(opinionColumns).set({ imageKey }).where(eq(opinionColumns.slug, slug));
}

export async function setBreakingImageKey(slug: string, imageKey: string) {
  const db = getDb();
  await db.update(breakingItems).set({ imageKey }).where(eq(breakingItems.slug, slug));
}

export async function listMissingIllustrations(): Promise<StoredStory[]> {
  const db = getDb();
  const [articleRows, opinionRows, breakingRows] = await Promise.all([
    db
      .select({ slug: articles.slug, headline: articles.headline, dek: articles.dek })
      .from(articles)
      .where(and(isNull(articles.imageKey), eq(articles.status, "published"))),
    db
      .select({ slug: opinionColumns.slug, headline: opinionColumns.headline, dek: opinionColumns.dek })
      .from(opinionColumns)
      .where(and(isNull(opinionColumns.imageKey), inArray(opinionColumns.status, ["draft", "published"]))),
    db
      .select({ slug: breakingItems.slug, headline: breakingItems.headline, dek: breakingItems.dek })
      .from(breakingItems)
      .where(and(eq(breakingItems.status, "published"), isNull(breakingItems.imageKey))),
  ]);
  return [
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
    ...opinionRows.map((row) => ({ kind: "opinion" as const, ...row })),
    ...breakingRows.flatMap((row) => {
      if (!row.slug || !row.headline || !row.dek) return [];
      return [{ kind: "breaking" as const, slug: row.slug, headline: row.headline, dek: row.dek }];
    }),
  ];
}
