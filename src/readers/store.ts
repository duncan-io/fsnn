import { io } from "next/cache";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { articleComments, articleLikes, readers } from "@/src/db/schema";
import { isUnreachableDatabase, violationName } from "@/src/readers/errors";
import { hashPassword } from "@/src/readers/password";
import { displayKey, normalizeDisplayName, normalizeEmail } from "@/src/readers/validate";

export type Engagement = {
  likes: number;
  comments: number;
};

export type StoryComment = {
  id: string;
  body: string;
  createdAt: string;
  readerId: string;
  displayName: string;
};

const emptyEngagement = { likes: 0, comments: 0 };

export async function engagementForSlugs(slugs: string[]) {
  const unique = [...new Set(slugs.filter((slug) => slug.length > 0))];
  const counts = new Map<string, Engagement>(
    unique.map((slug) => [slug, { likes: 0, comments: 0 }]),
  );
  if (unique.length === 0 || !process.env.DATABASE_URL) return counts;
  await io();
  try {
    const db = getDb();
    const [likeRows, commentRows] = await Promise.all([
      db
        .select({ slug: articleLikes.slug, total: count() })
        .from(articleLikes)
        .where(inArray(articleLikes.slug, unique))
        .groupBy(articleLikes.slug),
      db
        .select({ slug: articleComments.slug, total: count() })
        .from(articleComments)
        .where(inArray(articleComments.slug, unique))
        .groupBy(articleComments.slug),
    ]);
    for (const row of likeRows) {
      const current = counts.get(row.slug);
      if (current) current.likes = Number(row.total);
    }
    for (const row of commentRows) {
      const current = counts.get(row.slug);
      if (current) current.comments = Number(row.total);
    }
  } catch (error) {
    if (isUnreachableDatabase(error)) return counts;
    throw error;
  }
  return counts;
}

export function engagementFor(counts: Map<string, Engagement>, slug: string): Engagement {
  return counts.get(slug) ?? emptyEngagement;
}

export async function listComments(slug: string): Promise<StoryComment[]> {
  const rows = await getDb()
    .select({
      id: articleComments.id,
      body: articleComments.body,
      createdAt: articleComments.createdAt,
      readerId: articleComments.readerId,
      displayName: readers.displayName,
    })
    .from(articleComments)
    .innerJoin(readers, eq(articleComments.readerId, readers.id))
    .where(eq(articleComments.slug, slug))
    .orderBy(asc(articleComments.createdAt));
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readerId: row.readerId,
    displayName: row.displayName,
  }));
}

export async function readerLiked(readerId: string, slug: string) {
  const [row] = await getDb()
    .select({ slug: articleLikes.slug })
    .from(articleLikes)
    .where(and(eq(articleLikes.readerId, readerId), eq(articleLikes.slug, slug)))
    .limit(1);
  return Boolean(row);
}

export async function toggleArticleLike(readerId: string, slug: string) {
  const db = getDb();
  const where = and(eq(articleLikes.readerId, readerId), eq(articleLikes.slug, slug));
  const [existing] = await db.select({ slug: articleLikes.slug }).from(articleLikes).where(where).limit(1);
  if (existing) {
    await db.delete(articleLikes).where(where);
    return false;
  }
  try {
    await db.insert(articleLikes).values({ readerId, slug });
  } catch (error) {
    if (violationName(error)) return true;
    throw error;
  }
  return true;
}

export async function addComment(readerId: string, slug: string, body: string) {
  await getDb().insert(articleComments).values({ readerId, slug, body });
}

export async function deleteOwnComment(readerId: string, commentId: string) {
  await getDb()
    .delete(articleComments)
    .where(and(eq(articleComments.id, commentId), eq(articleComments.readerId, readerId)));
}

export async function readerByEmail(email: string) {
  const [row] = await getDb().select().from(readers).where(eq(readers.email, email)).limit(1);
  return row ?? null;
}

export async function createReader(input: { email: string; displayName: string; password: string }) {
  const email = normalizeEmail(input.email);
  const name = normalizeDisplayName(input.displayName);
  if (!email || !name) return { ok: false as const, reason: "fields" as const };
  const passwordHash = await hashPassword(input.password);
  try {
    const [row] = await getDb()
      .insert(readers)
      .values({
        email,
        displayName: name,
        displayKey: displayKey(name),
        passwordHash,
      })
      .returning({ id: readers.id });
    if (!row) return { ok: false as const, reason: "fields" as const };
    return { ok: true as const, id: row.id };
  } catch (error) {
    const constraint = violationName(error);
    if (!constraint) throw error;
    if (constraint.includes("display")) return { ok: false as const, reason: "name" as const };
    return { ok: false as const, reason: "email" as const };
  }
}
