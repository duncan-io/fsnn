import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { gameWeeks, leagues, matchups, players, rosterEntries, teams, transactions } from "../db/schema";
import { buildWeekBrief, completedWeek } from "./brief";
import type { BriefInput, WeekBrief } from "./types";

export async function listRecapLeagues() {
  const db = getDb();
  return db
    .select({ leagueKey: leagues.leagueKey, name: leagues.name, gameKey: leagues.gameKey })
    .from(leagues);
}

export async function latestCompletedWeek(leagueKey: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ week: matchups.week, status: matchups.status })
    .from(matchups)
    .where(eq(matchups.leagueKey, leagueKey));
  return completedWeek(rows);
}

export async function loadWeekBrief(leagueKey: string, week: number): Promise<WeekBrief | null> {
  const input = await loadBriefInput(leagueKey, week);
  if (!input) return null;
  if (completedWeek(input.matchups, week) == null) return null;
  const brief = buildWeekBrief(input);
  return brief.matchups.length > 0 ? brief : null;
}

async function loadBriefInput(leagueKey: string, week: number): Promise<BriefInput | null> {
  const db = getDb();
  const [league] = await db.select().from(leagues).where(eq(leagues.leagueKey, leagueKey));
  if (!league) return null;
  const [weekRow] = await db
    .select()
    .from(gameWeeks)
    .where(and(eq(gameWeeks.gameKey, league.gameKey), eq(gameWeeks.week, week)));
  const teamRows = await db.select().from(teams).where(eq(teams.leagueKey, leagueKey));
  const matchupRows = await db.select().from(matchups).where(eq(matchups.leagueKey, leagueKey));
  const rosterRows = await db
    .select()
    .from(rosterEntries)
    .where(and(eq(rosterEntries.leagueKey, leagueKey), eq(rosterEntries.week, week)));
  const playerKeys = [...new Set(rosterRows.map((row) => row.playerKey))];
  const playerRows =
    playerKeys.length === 0
      ? []
      : await db.select().from(players).where(inArray(players.playerKey, playerKeys));
  const playerByKey = new Map(playerRows.map((player) => [player.playerKey, player]));
  const transactionRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.leagueKey, leagueKey));

  return {
    leagueKey,
    leagueName: league.name ?? leagueKey,
    week,
    weekStart: weekRow?.startDate ?? null,
    weekEnd: weekRow?.endDate ?? null,
    teams: teamRows.map((team) => ({
      teamKey: team.teamKey,
      name: team.name ?? team.teamKey,
      managers: team.managers,
    })),
    matchups: matchupRows.map((row) => ({
      week: row.week,
      teamKey: row.teamKey,
      opponentTeamKey: row.opponentTeamKey,
      points: row.points,
      projectedPoints: row.projectedPoints,
      isWinner: row.isWinner,
      status: row.status,
    })),
    rosters: rosterRows.map((row) => {
      const player = playerByKey.get(row.playerKey);
      return {
        teamKey: row.teamKey,
        week: row.week,
        playerKey: row.playerKey,
        playerName: player?.name ?? nameFromRaw(row.raw),
        displayPosition: player?.displayPosition ?? null,
        selectedPosition: row.selectedPosition,
        raw: row.raw,
      };
    }),
    transactions: transactionRows.map((row) => ({
      type: row.type,
      status: row.status,
      timestamp: row.timestamp,
      faabBid: row.faabBid,
      players: row.players,
    })),
  };
}

function nameFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || !("name" in raw)) return null;
  const name = raw.name;
  if (typeof name === "string") return name;
  if (name && typeof name === "object" && "full" in name && typeof name.full === "string") return name.full;
  return null;
}
