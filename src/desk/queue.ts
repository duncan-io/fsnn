import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { articles } from "../db/schema";
import { illustrateStored } from "../images/illustrate";

export type HeldArticle = {
  id: string;
  week: number;
  kind: "recap" | "rankings";
  headline: string;
  dek: string;
  body: string;
  notes: string[];
  updatedAt: Date;
};

export async function listHeldArticles(): Promise<HeldArticle[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.status, "needs-edit"), inArray(articles.scope, ["league", "power-rankings"])))
    .orderBy(desc(articles.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    week: row.week,
    kind: row.scope === "power-rankings" ? "rankings" : "recap",
    headline: row.headline,
    dek: row.dek,
    body: articleBody(row.body),
    notes: noteList(row.reviewNotes),
    updatedAt: row.updatedAt,
  }));
}

export async function publishHeldArticle(id: string) {
  const family = await heldFamily(id);
  const now = new Date();
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const row of family) {
      await tx
        .update(articles)
        .set({
          status: "published",
          publishedAt: row.publishedAt ?? now,
          reviewNotes: null,
          updatedAt: now,
        })
        .where(eq(articles.id, row.id));
    }
  });
  for (const row of family) {
    await illustrateStored({ kind: "article", slug: row.slug, headline: row.headline, dek: row.dek });
  }
}

export async function discardHeldArticle(id: string) {
  const family = await heldFamily(id);
  const now = new Date();
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const row of family) {
      await tx.update(articles).set({ status: "discarded", updatedAt: now }).where(eq(articles.id, row.id));
    }
  });
}

async function heldFamily(id: string) {
  const db = getDb();
  const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!row || row.status !== "needs-edit") throw new Error("That piece is not waiting for review.");
  if (row.scope === "power-rankings") return [row];
  if (row.scope !== "league" && row.scope !== "matchup") throw new Error("That piece is not waiting for review.");
  return db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.leagueKey, row.leagueKey),
        eq(articles.week, row.week),
        inArray(articles.scope, ["league", "matchup"]),
        eq(articles.status, "needs-edit"),
      ),
    );
}

function articleBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const row = body as { lede?: unknown; kicker?: unknown; sections?: unknown; entries?: unknown };
  const parts: string[] = [];
  if (typeof row.lede === "string") parts.push(row.lede);
  if (Array.isArray(row.sections)) {
    for (const section of row.sections) {
      if (!section || typeof section !== "object") continue;
      const heading = (section as { heading?: unknown }).heading;
      const paragraphs = (section as { paragraphs?: unknown }).paragraphs;
      if (typeof heading === "string") parts.push(heading);
      if (Array.isArray(paragraphs)) {
        parts.push(...paragraphs.filter((item): item is string => typeof item === "string"));
      }
    }
  }
  if (Array.isArray(row.entries)) {
    for (const entry of row.entries) {
      if (!entry || typeof entry !== "object") continue;
      const paragraphs = (entry as { paragraphs?: unknown }).paragraphs;
      if (Array.isArray(paragraphs)) {
        parts.push(...paragraphs.filter((item): item is string => typeof item === "string"));
      }
    }
  }
  if (typeof row.kicker === "string") parts.push(row.kicker);
  return parts.join("\n\n");
}

function noteList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
