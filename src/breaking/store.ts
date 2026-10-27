import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../db/client";
import { breakingItems, playerOwnership, players, rosterEntries, teamStandings, teams, transactions } from "../db/schema";
import { mediaPath } from "../images/key";
import { resolveLeague } from "../opinion/store";
import type { BreakingClub, BreakingPlayer, BreakingStarter, BreakingTransaction } from "./candidates";

const DAY_MS = 24 * 60 * 60 * 1000;

export type BreakingStory = {
  id: string;
  slug: string;
  leagueKey: string;
  week: number;
  kind: string;
  headline: string;
  dek: string;
  body: string;
  teamKeys: string[];
  reporterName: string;
  reporterBeat: string;
  reporterInitials: string;
  imageUrl?: string;
  publishedAt: Date;
};

export type BreakingFacts = {
  transactions: BreakingTransaction[];
  starters: BreakingStarter[];
  clubs: BreakingClub[];
  seasonPoints: Map<string, number>;
};

export async function loadBreakingFacts(leagueKey: string, week: number): Promise<BreakingFacts> {
  const db = getDb();
  const [transactionRows, rosterRows, clubRows, ownershipRows] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.leagueKey, leagueKey)),
    db
      .select({
        playerKey: rosterEntries.playerKey,
        teamKey: rosterEntries.teamKey,
        selectedPosition: rosterEntries.selectedPosition,
        name: players.name,
        status: players.status,
        injuryNote: players.injuryNote,
        seasonPoints: playerOwnership.seasonPoints,
      })
      .from(rosterEntries)
      .leftJoin(players, eq(players.playerKey, rosterEntries.playerKey))
      .leftJoin(
        playerOwnership,
        and(eq(playerOwnership.leagueKey, rosterEntries.leagueKey), eq(playerOwnership.playerKey, rosterEntries.playerKey)),
      )
      .where(and(eq(rosterEntries.leagueKey, leagueKey), eq(rosterEntries.week, week))),
    db
      .select({
        teamKey: teams.teamKey,
        teamName: teams.name,
        wins: teamStandings.wins,
        losses: teamStandings.losses,
        ties: teamStandings.ties,
        rank: teamStandings.rank,
      })
      .from(teams)
      .leftJoin(teamStandings, eq(teamStandings.teamKey, teams.teamKey))
      .where(eq(teams.leagueKey, leagueKey)),
    db
      .select({ playerKey: playerOwnership.playerKey, seasonPoints: playerOwnership.seasonPoints })
      .from(playerOwnership)
      .where(eq(playerOwnership.leagueKey, leagueKey)),
  ]);

  const seasonPoints = new Map<string, number>();
  for (const row of ownershipRows) {
    const points = num(row.seasonPoints);
    if (points != null) seasonPoints.set(row.playerKey, points);
  }

  return {
    transactions: transactionRows.map((row) => ({
      transactionKey: row.transactionKey,
      type: row.type,
      status: row.status,
      timestamp: row.timestamp,
      faabBid: row.faabBid,
      players: readPlayers(row.players),
    })),
    starters: rosterRows.flatMap((row) => {
      const name = row.name?.trim() ?? "";
      if (!name) return [];
      const starter: BreakingStarter = {
        playerKey: row.playerKey,
        name,
        teamKey: row.teamKey,
        selectedPosition: row.selectedPosition,
        status: row.status,
        injuryNote: row.injuryNote,
        seasonPoints: num(row.seasonPoints),
      };
      return [starter];
    }),
    clubs: clubRows.map((row) => ({
      teamKey: row.teamKey,
      teamName: row.teamName?.trim() || "A club",
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      rank: row.rank,
    })),
    seasonPoints,
  };
}

export async function breakingState(leagueKey: string): Promise<{
  initialized: boolean;
  seen: Set<string>;
  publishedLastDay: number;
}> {
  const db = getDb();
  const since = Date.now() - DAY_MS;
  const rows = await db
    .select({
      sourceKey: breakingItems.sourceKey,
      status: breakingItems.status,
      publishedAt: breakingItems.publishedAt,
    })
    .from(breakingItems)
    .where(eq(breakingItems.leagueKey, leagueKey));
  return {
    initialized: rows.length > 0,
    seen: new Set(rows.map((row) => row.sourceKey)),
    publishedLastDay: rows.filter(
      (row) => row.status === "published" && row.publishedAt != null && row.publishedAt.getTime() >= since,
    ).length,
  };
}

export async function insertBreakingBaseline(
  leagueKey: string,
  week: number,
  candidates: Array<{
    kind: string;
    sourceKey: string;
    heat: number;
    teamKeys: string[];
    lines: string[];
    eventAt: Date | null;
  }>,
) {
  const db = getDb();
  const rows =
    candidates.length > 0
      ? candidates.map((candidate) => ({
          leagueKey,
          week,
          kind: candidate.kind,
          sourceKey: candidate.sourceKey,
          heat: candidate.heat,
          status: "baseline",
          teamKeys: candidate.teamKeys,
          brief: { lines: candidate.lines },
          eventAt: candidate.eventAt,
        }))
      : [
          {
            leagueKey,
            week,
            kind: "baseline",
            sourceKey: "baseline",
            heat: 0,
            status: "baseline",
            teamKeys: [] as string[],
          },
        ];
  await db
    .insert(breakingItems)
    .values(rows)
    .onConflictDoNothing({ target: [breakingItems.leagueKey, breakingItems.sourceKey] });
}

export type PublishedBreakingInput = {
  leagueKey: string;
  week: number;
  kind: string;
  sourceKey: string;
  heat: number;
  slug: string;
  headline: string;
  dek: string;
  body: string;
  brief: { lines: string[] };
  teamKeys: string[];
  reporterName: string;
  reporterBeat: string;
  reporterInitials: string;
  eventAt: Date | null;
};

export async function insertPublishedBreaking(input: PublishedBreakingInput): Promise<{ slug: string }> {
  const db = getDb();
  const slug = await unusedSlug(input.slug, input.sourceKey);
  const inserted = await db
    .insert(breakingItems)
    .values({
      leagueKey: input.leagueKey,
      week: input.week,
      kind: input.kind,
      sourceKey: input.sourceKey,
      heat: input.heat,
      status: "published",
      slug,
      headline: input.headline,
      dek: input.dek,
      body: input.body,
      brief: input.brief,
      teamKeys: input.teamKeys,
      reporterName: input.reporterName,
      reporterBeat: input.reporterBeat,
      reporterInitials: input.reporterInitials,
      eventAt: input.eventAt,
      publishedAt: new Date(),
    })
    .returning({ slug: breakingItems.slug });
  const saved = inserted[0]?.slug;
  if (!saved) throw new Error("The breaking story was not saved.");
  return { slug: saved };
}

export async function listPublishedBreaking(options: { since?: Date; limit: number }): Promise<BreakingStory[]> {
  const league = await resolveLeague();
  const db = getDb();
  const filters = [eq(breakingItems.leagueKey, league.leagueKey), eq(breakingItems.status, "published")];
  if (options.since) filters.push(gte(breakingItems.publishedAt, options.since));
  const rows = await db
    .select()
    .from(breakingItems)
    .where(and(...filters))
    .orderBy(desc(breakingItems.publishedAt))
    .limit(options.limit);
  return rows.flatMap((row) => {
    const story = toStory(row);
    return story ? [story] : [];
  });
}

export async function getPublishedBreaking(slug: string): Promise<BreakingStory | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(breakingItems)
    .where(and(eq(breakingItems.slug, slug), eq(breakingItems.status, "published")))
    .limit(1);
  return row ? toStory(row) : null;
}

async function unusedSlug(slug: string, sourceKey: string): Promise<string> {
  const db = getDb();
  const [taken] = await db
    .select({ slug: breakingItems.slug })
    .from(breakingItems)
    .where(eq(breakingItems.slug, slug))
    .limit(1);
  if (!taken) return slug;
  const tail = sourceKey.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-8);
  return `${slug}-${tail || "wire"}`;
}

function toStory(row: typeof breakingItems.$inferSelect): BreakingStory | null {
  if (!row.slug || !row.headline || !row.dek || !row.body || !row.publishedAt) return null;
  if (!row.reporterName || !row.reporterBeat || !row.reporterInitials) return null;
  return {
    id: row.id,
    slug: row.slug,
    leagueKey: row.leagueKey,
    week: row.week,
    kind: row.kind,
    headline: row.headline,
    dek: row.dek,
    body: row.body,
    teamKeys: row.teamKeys,
    reporterName: row.reporterName,
    reporterBeat: row.reporterBeat,
    reporterInitials: row.reporterInitials,
    imageUrl: mediaPath(row.imageKey),
    publishedAt: row.publishedAt,
  };
}

function readPlayers(value: unknown): BreakingPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [
      {
        name: typeof row.name === "string" ? row.name : null,
        type: typeof row.type === "string" ? row.type : null,
        sourceTeamKey: typeof row.sourceTeamKey === "string" ? row.sourceTeamKey : null,
        destinationTeamKey: typeof row.destinationTeamKey === "string" ? row.destinationTeamKey : null,
        playerKey: typeof row.playerKey === "string" ? row.playerKey : null,
      },
    ];
  });
}

function num(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
