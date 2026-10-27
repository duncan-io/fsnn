import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  gameWeeks,
  leagues,
  matchups,
  opinionColumns,
  playerOwnership,
  rosterEntries,
  teamStandings,
  teams,
  transactions,
} from "../db/schema";
import { rewindActivity, seasonPointsThrough } from "../facts/asof";
import { recordsThrough } from "../facts/memory";
import { mediaPath } from "../images/key";
import { completedWeek, inWeekWindow, playerWeekPoints } from "../recap/brief";
import type { OpinionBrief, OpinionDesk, TeamSeason, WaiverAdd, WeekLine } from "./types";

export type LeagueContext = {
  leagueKey: string;
  name: string;
  currentWeek: number;
};

export type OpinionColumnView = {
  id: string;
  slug: string;
  leagueKey: string;
  week: number;
  desk: string;
  headline: string;
  dek: string;
  body: string;
  status: string;
  angleId: string;
  brief: OpinionBrief;
  teamKeys: string[];
  columnistName: string;
  columnistBeat: string;
  columnistInitials: string;
  imageUrl?: string;
  reviewNotes: string[];
  createdAt: Date;
  publishedAt: Date | null;
};

export async function resolveLeague(): Promise<LeagueContext> {
  const db = getDb();
  const key = process.env.LEAGUE_KEY?.trim();
  const rows = key
    ? await db.select().from(leagues).where(eq(leagues.leagueKey, key))
    : await db.select().from(leagues);
  if (rows.length === 0) {
    throw new Error(key ? `No league stored for ${key}. Sync Yahoo first.` : "No leagues stored. Sync Yahoo first.");
  }
  if (!key && rows.length > 1) throw new Error("More than one league is synced. Set LEAGUE_KEY.");
  const league = rows[0];
  if (!league?.currentWeek) throw new Error("This league has no current week. Sync Yahoo first.");
  return {
    leagueKey: league.leagueKey,
    name: league.name?.trim() || "This league",
    currentWeek: league.currentWeek,
  };
}

export async function findWeekColumn(leagueKey: string, week: number, desk: OpinionDesk) {
  const db = getDb();
  const [row] = await db
    .select({ slug: opinionColumns.slug, status: opinionColumns.status })
    .from(opinionColumns)
    .where(
      and(eq(opinionColumns.leagueKey, leagueKey), eq(opinionColumns.week, week), eq(opinionColumns.desk, desk)),
    )
    .limit(1);
  return row ?? null;
}

export async function usedAngleKeys(leagueKey: string, beforeWeek?: number): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({
      angleId: opinionColumns.angleId,
      teamKeys: opinionColumns.teamKeys,
      status: opinionColumns.status,
      week: opinionColumns.week,
    })
    .from(opinionColumns)
    .where(eq(opinionColumns.leagueKey, leagueKey));
  const used = new Set<string>();
  for (const row of rows) {
    if (row.status === "discarded") continue;
    if (beforeWeek != null && row.week >= beforeWeek) continue;
    for (const teamKey of row.teamKeys) used.add(`${row.angleId}:${teamKey}`);
  }
  return used;
}

export async function loadStandings(leagueKey: string, week?: number): Promise<TeamSeason[]> {
  if (week == null || !(await isHistoricalWeek(leagueKey, week))) return loadLiveStandings(leagueKey);
  return loadHistoricalStandings(leagueKey, week);
}

async function loadLiveStandings(leagueKey: string): Promise<TeamSeason[]> {
  const db = getDb();
  const [standingRows, teamRows] = await Promise.all([
    db.select().from(teamStandings).where(eq(teamStandings.leagueKey, leagueKey)),
    db.select().from(teams).where(eq(teams.leagueKey, leagueKey)),
  ]);
  const byTeam = new Map(teamRows.map((team) => [team.teamKey, team]));
  const seasons: TeamSeason[] = [];
  for (const row of standingRows) {
    const team = byTeam.get(row.teamKey);
    const pointsFor = num(row.pointsFor);
    const pointsAgainst = num(row.pointsAgainst);
    if (!team || row.rank == null || pointsFor == null || pointsAgainst == null) continue;
    seasons.push({
      teamKey: row.teamKey,
      teamName: team.name?.trim() || row.teamKey,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      ties: row.ties ?? 0,
      pointsFor,
      pointsAgainst,
      rank: row.rank,
      moves: team.numberOfMoves ?? 0,
    });
  }
  return seasons;
}

export async function loadWeekLines(
  leagueKey: string,
  standings: TeamSeason[],
  week?: number,
): Promise<WeekLine[]> {
  const db = getDb();
  const [rows, teamRows] = await Promise.all([
    db.select().from(matchups).where(eq(matchups.leagueKey, leagueKey)),
    db.select({ teamKey: teams.teamKey, name: teams.name }).from(teams).where(eq(teams.leagueKey, leagueKey)),
  ]);
  const completed = rows.filter(
    (row) => row.status === "postevent" && num(row.points) != null && num(row.projectedPoints) != null,
  );
  if (completed.length === 0) return [];
  const target = week ?? Math.max(...completed.map((row) => row.week));
  const weekRows = completed.filter((row) => row.week === target);
  const byTeam = new Map(weekRows.map((row) => [row.teamKey, row]));
  const names = new Map(teamRows.map((team) => [team.teamKey, team.name?.trim() || team.teamKey]));
  const seasons = new Map(standings.map((team) => [team.teamKey, team]));
  const lines: WeekLine[] = [];
  for (const row of weekRows) {
    const points = num(row.points);
    const projected = num(row.projectedPoints);
    if (points == null || projected == null || !row.opponentTeamKey) continue;
    const opponentPoints = num(byTeam.get(row.opponentTeamKey)?.points);
    if (opponentPoints == null) continue;
    const season = seasons.get(row.teamKey);
    lines.push({
      week: target,
      teamKey: row.teamKey,
      teamName: names.get(row.teamKey) ?? row.teamKey,
      points,
      projectedPoints: projected,
      opponentName: names.get(row.opponentTeamKey) ?? "opponent",
      opponentPoints,
      seasonPointsFor: season?.pointsFor ?? 0,
      wins: season?.wins ?? 0,
      losses: season?.losses ?? 0,
      ties: season?.ties ?? 0,
    });
  }
  return lines;
}

export async function loadWaiverAdds(
  leagueKey: string,
  standings: TeamSeason[],
  options: { now?: Date; week?: number } = {},
): Promise<WaiverAdd[]> {
  const db = getDb();
  if (options.week == null) {
    const since = new Date((options.now ?? new Date()).getTime() - 7 * 24 * 60 * 60 * 1000);
    const [rows, points] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(and(eq(transactions.leagueKey, leagueKey), gte(transactions.timestamp, since))),
      ownershipPoints(leagueKey),
    ]);
    return waiverAdds(rows, standings, points);
  }
  const [rows, dates, historical] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.leagueKey, leagueKey)),
    weekWindow(leagueKey, options.week),
    isHistoricalWeek(leagueKey, options.week),
  ]);
  const points = historical ? await rosterPointsThrough(leagueKey, options.week) : await ownershipPoints(leagueKey);
  const inWeek = rows.filter(
    (row) => row.timestamp != null && inWeekWindow(row.timestamp, dates.start, dates.end),
  );
  return waiverAdds(inWeek, standings, points);
}

export async function replaceOpinionColumn(
  values: typeof opinionColumns.$inferInsert,
): Promise<{ outcome: "ok"; slug: string }> {
  try {
    await upsertOpinion(values);
    return { outcome: "ok", slug: values.slug };
  } catch (error) {
    const constraint = violationName(error);
    if (!constraint?.includes("slug")) throw error;
    const slug = `${values.slug}-${values.angleId}`;
    await upsertOpinion({ ...values, slug });
    return { outcome: "ok", slug };
  }
}

async function upsertOpinion(values: typeof opinionColumns.$inferInsert) {
  const db = getDb();
  await db
    .insert(opinionColumns)
    .values(values)
    .onConflictDoUpdate({
      target: [opinionColumns.leagueKey, opinionColumns.week, opinionColumns.desk],
      set: {
        slug: values.slug,
        headline: values.headline,
        dek: values.dek,
        body: values.body,
        status: values.status,
        angleId: values.angleId,
        brief: values.brief,
        teamKeys: values.teamKeys,
        columnistName: values.columnistName,
        columnistBeat: values.columnistBeat,
        columnistInitials: values.columnistInitials,
        publishedAt: values.publishedAt ?? null,
        reviewNotes: values.reviewNotes ?? null,
        imageKey: null,
      },
    });
}

export async function insertOpinionColumn(
  values: typeof opinionColumns.$inferInsert,
): Promise<{ outcome: "ok"; slug: string } | { outcome: "exists" }> {
  const db = getDb();
  try {
    await db.insert(opinionColumns).values(values);
    return { outcome: "ok", slug: values.slug };
  } catch (error) {
    const constraint = violationName(error);
    if (!constraint) throw error;
    if (constraint.includes("slug")) {
      const slug = `${values.slug}-${values.angleId}`;
      await db.insert(opinionColumns).values({ ...values, slug });
      return { outcome: "ok", slug };
    }
    return { outcome: "exists" };
  }
}

export async function listReviewColumns(): Promise<OpinionColumnView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(opinionColumns)
    .where(inArray(opinionColumns.status, ["draft", "needs-edit"]))
    .orderBy(desc(opinionColumns.createdAt));
  return rows.flatMap((row) => {
    const view = toView(row);
    return view ? [view] : [];
  });
}

export async function listPublishedOpinions(limit: number): Promise<OpinionColumnView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(opinionColumns)
    .where(eq(opinionColumns.status, "published"))
    .orderBy(desc(opinionColumns.publishedAt))
    .limit(limit);
  return rows.flatMap((row) => {
    const view = toView(row);
    return view ? [view] : [];
  });
}

export async function getPublishedOpinion(slug: string): Promise<OpinionColumnView | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(opinionColumns)
    .where(and(eq(opinionColumns.slug, slug), eq(opinionColumns.status, "published")))
    .limit(1);
  return row ? toView(row) : null;
}

export async function publishOpinion(id: string) {
  const db = getDb();
  const updated = await db
    .update(opinionColumns)
    .set({ status: "published", publishedAt: new Date(), reviewNotes: null })
    .where(and(eq(opinionColumns.id, id), inArray(opinionColumns.status, ["draft", "needs-edit"])))
    .returning({ id: opinionColumns.id });
  if (updated.length === 0) throw new Error("That column is not waiting for review.");
}

export async function discardOpinion(id: string) {
  const db = getDb();
  const updated = await db
    .update(opinionColumns)
    .set({ status: "discarded" })
    .where(and(eq(opinionColumns.id, id), inArray(opinionColumns.status, ["draft", "needs-edit", "published"])))
    .returning({ id: opinionColumns.id });
  if (updated.length === 0) throw new Error("That column is already discarded.");
}

function toView(row: typeof opinionColumns.$inferSelect): OpinionColumnView | null {
  const brief = asBrief(row.brief);
  if (!brief) return null;
  return {
    id: row.id,
    slug: row.slug,
    leagueKey: row.leagueKey,
    week: row.week,
    desk: row.desk,
    headline: row.headline,
    dek: row.dek,
    body: row.body,
    status: row.status,
    angleId: row.angleId,
    brief,
    teamKeys: row.teamKeys,
    columnistName: row.columnistName,
    columnistBeat: row.columnistBeat,
    columnistInitials: row.columnistInitials,
    imageUrl: mediaPath(row.imageKey),
    reviewNotes: noteList(row.reviewNotes),
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
  };
}

function noteList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asBrief(value: unknown): OpinionBrief | null {
  if (!value || typeof value !== "object") return null;
  const brief = value as OpinionBrief;
  if (typeof brief.claim !== "string" || !Array.isArray(brief.evidence) || !Array.isArray(brief.counterEvidence)) {
    return null;
  }
  if (!brief.evidence.every((item) => typeof item === "string")) return null;
  if (!brief.counterEvidence.every((item) => typeof item === "string")) return null;
  if (typeof brief.heat !== "number") return null;
  return brief;
}

async function isHistoricalWeek(leagueKey: string, week: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ week: matchups.week, status: matchups.status })
    .from(matchups)
    .where(eq(matchups.leagueKey, leagueKey));
  const latest = completedWeek(rows);
  return latest != null && week < latest;
}

async function loadHistoricalStandings(leagueKey: string, week: number): Promise<TeamSeason[]> {
  const db = getDb();
  const [teamRows, matchupRows, transactionRows, window] = await Promise.all([
    db.select().from(teams).where(eq(teams.leagueKey, leagueKey)),
    db.select().from(matchups).where(eq(matchups.leagueKey, leagueKey)),
    db.select().from(transactions).where(eq(transactions.leagueKey, leagueKey)),
    weekWindow(leagueKey, week),
  ]);
  const names = new Map(teamRows.map((team) => [team.teamKey, team.name?.trim() || team.teamKey]));
  const records = recordsThrough(
    [...names.entries()].map(([teamKey, teamName]) => ({ teamKey, teamName })),
    matchupRows.map((row) => ({
      week: row.week,
      teamKey: row.teamKey,
      opponentTeamKey: row.opponentTeamKey,
      points: num(row.points),
      status: row.status,
    })),
    week,
  );
  const rewound = rewindActivity(
    teamRows.map((team) => ({
      teamKey: team.teamKey,
      faabBalance: team.faabBalance,
      moves: team.numberOfMoves,
      trades: team.numberOfTrades,
    })),
    transactionRows.map((row) => ({
      type: row.type,
      status: row.status,
      timestamp: row.timestamp,
      faabBid: row.faabBid,
      players: row.players,
    })),
    window.end,
  );
  return records.map((record) => ({
    teamKey: record.teamKey,
    teamName: names.get(record.teamKey) ?? record.teamKey,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    pointsFor: record.pointsFor,
    pointsAgainst: record.pointsAgainst,
    rank: record.rank,
    moves: rewound.get(record.teamKey)?.moves ?? 0,
  }));
}

async function weekWindow(leagueKey: string, week: number): Promise<{ start: string | null; end: string | null }> {
  const db = getDb();
  const [league] = await db
    .select({ gameKey: leagues.gameKey })
    .from(leagues)
    .where(eq(leagues.leagueKey, leagueKey))
    .limit(1);
  if (!league) return { start: null, end: null };
  const [row] = await db
    .select({ startDate: gameWeeks.startDate, endDate: gameWeeks.endDate })
    .from(gameWeeks)
    .where(and(eq(gameWeeks.gameKey, league.gameKey), eq(gameWeeks.week, week)))
    .limit(1);
  return { start: row?.startDate ?? null, end: row?.endDate ?? null };
}

async function ownershipPoints(leagueKey: string): Promise<Map<string, number | null>> {
  const db = getDb();
  const ownership = await db
    .select({ playerKey: playerOwnership.playerKey, seasonPoints: playerOwnership.seasonPoints })
    .from(playerOwnership)
    .where(eq(playerOwnership.leagueKey, leagueKey));
  return new Map(ownership.map((row) => [row.playerKey, num(row.seasonPoints)]));
}

async function rosterPointsThrough(leagueKey: string, week: number): Promise<Map<string, number | null>> {
  const db = getDb();
  const rows = await db
    .select({
      playerKey: rosterEntries.playerKey,
      week: rosterEntries.week,
      raw: rosterEntries.raw,
    })
    .from(rosterEntries)
    .where(and(eq(rosterEntries.leagueKey, leagueKey), lte(rosterEntries.week, week)));
  const totals = seasonPointsThrough(
    rows.map((row) => ({
      playerKey: row.playerKey,
      week: row.week,
      points: playerWeekPoints(row.raw),
    })),
    week,
  );
  return new Map(totals);
}

function waiverAdds(
  rows: Array<{ status: string | null; faabBid: number | null; players: unknown }>,
  standings: TeamSeason[],
  points: Map<string, number | null>,
): WaiverAdd[] {
  const seasons = new Map(standings.map((team) => [team.teamKey, team]));
  const adds: WaiverAdd[] = [];
  for (const row of rows) {
    if (row.status !== "successful" || row.faabBid == null || row.faabBid <= 0) continue;
    const player = addedPlayer(row.players);
    if (!player) continue;
    const season = seasons.get(player.teamKey);
    if (!season) continue;
    adds.push({
      teamKey: season.teamKey,
      teamName: season.teamName,
      playerName: player.name,
      bid: row.faabBid,
      seasonPoints: points.get(player.playerKey) ?? null,
      wins: season.wins,
      losses: season.losses,
      ties: season.ties,
      rank: season.rank,
      pointsFor: season.pointsFor,
    });
  }
  return adds;
}

function addedPlayer(players: unknown): { name: string; playerKey: string; teamKey: string } | null {
  if (!Array.isArray(players)) return null;
  for (const player of players) {
    if (!player || typeof player !== "object") continue;
    const row = player as {
      name?: unknown;
      type?: unknown;
      playerKey?: unknown;
      destinationTeamKey?: unknown;
    };
    if (row.type !== "add") continue;
    if (typeof row.name !== "string" || typeof row.playerKey !== "string" || typeof row.destinationTeamKey !== "string") {
      continue;
    }
    return { name: row.name, playerKey: row.playerKey, teamKey: row.destinationTeamKey };
  }
  return null;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function violationName(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const row = current as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    const unique = row.code === "23505" || (row.message ?? "").includes("duplicate key");
    if (unique) return row.constraint_name ?? row.constraint ?? row.message ?? "unique";
    current = row.cause;
  }
  return null;
}
