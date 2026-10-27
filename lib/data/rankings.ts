import { cacheLife, cacheTag, io } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import type { Article, Team } from "@/lib/types";
import { getDb } from "@/src/db/client";
import { articles } from "@/src/db/schema";
import { mediaPath } from "@/src/images/key";
import { teamsFromRankings } from "@/src/rankings/display";
import type { RankingsBody, RankingsBrief } from "@/src/rankings/types";
import { readTimeMinutes } from "@/src/recap/display";

export type StoredRanking = {
  article: Article;
  teams: Team[];
  body: RankingsBody;
  brief: RankingsBrief;
};

type ArticleRow = typeof articles.$inferSelect;

export async function getPowerRankings(): Promise<StoredRanking[]> {
  if (!process.env.DATABASE_URL) return [];
  await io();
  try {
    return await readPowerRankings();
  } catch (error) {
    if (isUnreachableDatabase(error)) return [];
    throw error;
  }
}

export async function getStoredRanking(slug: string): Promise<StoredRanking | null> {
  if (!process.env.DATABASE_URL) return null;
  await io();
  try {
    return await readStoredRanking(slug);
  } catch (error) {
    if (isUnreachableDatabase(error)) return null;
    throw error;
  }
}

async function readPowerRankings(): Promise<StoredRanking[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("rankings");
  const db = getDb();
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.scope, "power-rankings"), eq(articles.status, "published")))
    .orderBy(desc(articles.week), desc(articles.publishedAt));
  return rows.flatMap((row) => {
    const stored = toStored(row);
    return stored ? [stored] : [];
  });
}

async function readStoredRanking(slug: string): Promise<StoredRanking | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("rankings");
  const db = getDb();
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.status, "published")))
    .limit(1);
  if (!row || row.scope !== "power-rankings") return null;
  return toStored(row);
}

function toStored(row: ArticleRow): StoredRanking | null {
  const brief = asBrief(row.factSheet);
  const body = asBody(row.body);
  if (!brief || !body) return null;
  return {
    article: toArticle(row, body),
    teams: teamsFromRankings(brief),
    body,
    brief,
  };
}

function toArticle(row: ArticleRow, body: RankingsBody): Article {
  const copy = [row.headline, row.dek, bodyText(body)].join(" ");
  const teamKeys = Array.isArray(row.teamKeys)
    ? row.teamKeys.filter((key): key is string => typeof key === "string")
    : [];
  return {
    id: row.id,
    slug: row.slug,
    kind: "power-rankings",
    headline: row.headline,
    dek: row.dek,
    teamIds: teamKeys,
    reporter: {
      name: row.reporterName,
      beat: row.reporterBeat,
      initials: row.reporterInitials,
    },
    publishedAt: row.publishedAt?.toISOString() ?? row.updatedAt.toISOString(),
    readTimeMinutes: readTimeMinutes(copy),
    tags: [`week ${row.week}`, "rankings"],
    imageUrl: mediaPath(row.imageKey),
  };
}

function bodyText(body: RankingsBody): string {
  return [body.lede, ...body.entries.flatMap((entry) => entry.paragraphs), body.kicker ?? ""].join(" ");
}

function asBrief(value: unknown): RankingsBrief | null {
  if (!value || typeof value !== "object") return null;
  const brief = value as RankingsBrief;
  if (typeof brief.leagueName !== "string" || typeof brief.week !== "number" || !Array.isArray(brief.teams)) {
    return null;
  }
  if (brief.teams.some((team) => !team || typeof team.teamKey !== "string" || typeof team.rank !== "number")) {
    return null;
  }
  return brief;
}

function asBody(value: unknown): RankingsBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as RankingsBody;
  if (typeof body.lede !== "string" || !Array.isArray(body.entries)) return null;
  if (body.entries.some((entry) => !entry || typeof entry.teamKey !== "string" || !Array.isArray(entry.paragraphs))) {
    return null;
  }
  return body;
}

const unreachableCodes = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

function isUnreachableDatabase(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string" && unreachableCodes.has(current.code)) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
