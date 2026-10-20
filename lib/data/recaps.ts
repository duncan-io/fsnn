import { cacheLife, cacheTag, io } from "next/cache";
import { desc, eq } from "drizzle-orm";
import type { Article, Team } from "@/lib/types";
import { getDb } from "@/src/db/client";
import { articles } from "@/src/db/schema";
import { readTimeMinutes, teamsFromBrief } from "@/src/recap/display";
import { recapSlug, matchupAnchor } from "@/src/recap/slug";
import type { RecapBody, WeekBrief } from "@/src/recap/types";

export type WeeklyRecapPackage = {
  week: number;
  leagueName: string;
  column: Article;
  cards: Article[];
  teams: Team[];
  body: RecapBody;
};

export type StoredRecap = {
  article: Article;
  teams: Team[];
  scope: "league" | "matchup";
  body: RecapBody | null;
  brief: WeekBrief;
  columnSlug: string;
  matchupAnchorId: string | null;
};

type ArticleRow = typeof articles.$inferSelect;

export async function getWeeklyRecaps(): Promise<WeeklyRecapPackage[]> {
  if (!process.env.DATABASE_URL) return [];
  // `postgres.railway.internal` only resolves on the Railway private network.
  // A production build runs outside that network, so the query has to wait
  // until a request, inside a Suspense boundary.
  await io();
  try {
    return await readWeeklyRecaps();
  } catch (error) {
    if (isUnreachableDatabase(error)) return [];
    throw error;
  }
}

async function readWeeklyRecaps(): Promise<WeeklyRecapPackage[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("recaps");
  const rows = await selectArticles();
  const leagueRows = rows.filter((row) => row.scope === "league");
  const latest = leagueRows.reduce((max, row) => Math.max(max, row.week), 0);
  if (latest === 0) return [];
  const current = rows.filter((row) => row.week === latest);
  const packages: WeeklyRecapPackage[] = [];
  for (const columnRow of current.filter((row) => row.scope === "league")) {
    const brief = asBrief(columnRow.factSheet);
    const body = asBody(columnRow.body);
    if (!brief || !body) continue;
    const teams = teamsFromBrief(brief);
    const order = new Map(body.sections.map((section, index) => [section.matchupKey, index]));
    const cards = current
      .filter((row) => row.scope === "matchup" && row.leagueKey === columnRow.leagueKey)
      .sort((a, b) => (order.get(a.matchupKey ?? "") ?? 0) - (order.get(b.matchupKey ?? "") ?? 0))
      .map((row) => toArticle(row));
    packages.push({
      week: columnRow.week,
      leagueName: brief.leagueName,
      column: toArticle(columnRow, body),
      cards,
      teams,
      body,
    });
  }
  return packages;
}

export async function getStoredRecap(slug: string): Promise<StoredRecap | null> {
  if (!process.env.DATABASE_URL) return null;
  await io();
  try {
    return await readStoredRecap(slug);
  } catch (error) {
    if (isUnreachableDatabase(error)) return null;
    throw error;
  }
}

async function readStoredRecap(slug: string): Promise<StoredRecap | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("recaps");
  const db = getDb();
  const [row] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  if (!row) return null;
  const brief = asBrief(row.factSheet);
  if (!brief) return null;
  const body = asBody(row.body);
  const scope = row.scope === "matchup" ? "matchup" : "league";
  return {
    article: toArticle(row, body),
    teams: teamsFromBrief(brief),
    scope,
    body,
    brief,
    columnSlug: recapSlug(row.leagueKey, row.week, null),
    matchupAnchorId: row.matchupKey ? matchupAnchor(row.matchupKey) : null,
  };
}

async function selectArticles(): Promise<ArticleRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const db = getDb();
  return db.select().from(articles).orderBy(desc(articles.week));
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

function toArticle(row: ArticleRow, body?: RecapBody | null): Article {
  const copy = [row.headline, row.dek, body ? bodyText(body) : ""].join(" ");
  const teamKeys = Array.isArray(row.teamKeys)
    ? row.teamKeys.filter((key): key is string => typeof key === "string")
    : [];
  return {
    id: row.id,
    slug: row.slug,
    kind: "weekly-recap",
    headline: row.headline,
    dek: row.dek,
    teamIds: teamKeys,
    reporter: {
      name: row.reporterName,
      beat: row.reporterBeat,
      initials: row.reporterInitials,
    },
    publishedAt: row.publishedAt.toISOString(),
    readTimeMinutes: readTimeMinutes(copy),
    tags: [`week ${row.week}`, "recap"],
  };
}

function bodyText(body: RecapBody): string {
  return [
    body.lede,
    ...body.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    body.kicker ?? "",
  ].join(" ");
}

function asBrief(value: unknown): WeekBrief | null {
  if (!value || typeof value !== "object") return null;
  const brief = value as WeekBrief;
  if (typeof brief.leagueName !== "string" || !Array.isArray(brief.matchups)) return null;
  return brief;
}

function asBody(value: unknown): RecapBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as RecapBody;
  if (typeof body.lede !== "string" || !Array.isArray(body.sections)) return null;
  return body;
}
