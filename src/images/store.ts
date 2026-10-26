import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { articles, opinionColumns } from "../db/schema";

export type StoredStory = {
  kind: "article" | "opinion";
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

export async function listMissingIllustrations(): Promise<StoredStory[]> {
  const db = getDb();
  const [articleRows, opinionRows] = await Promise.all([
    db
      .select({ slug: articles.slug, headline: articles.headline, dek: articles.dek })
      .from(articles)
      .where(isNull(articles.imageKey)),
    db
      .select({ slug: opinionColumns.slug, headline: opinionColumns.headline, dek: opinionColumns.dek })
      .from(opinionColumns)
      .where(and(isNull(opinionColumns.imageKey), ne(opinionColumns.status, "discarded"))),
  ]);
  return [
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
    ...opinionRows.map((row) => ({ kind: "opinion" as const, ...row })),
  ];
}
