import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { articles } from "../db/schema";
import { assembleDossier, loadLeagueWeek } from "../facts/dossier";
import { completedWeek } from "../recap/brief";
import { activityNotes } from "./notes";
import { scoreLeague } from "./score";
import type { RankingsBrief, RankingsTeamFact } from "./types";

export async function loadRankingsBrief(leagueKey: string, week: number): Promise<RankingsBrief | null> {
  const source = await loadLeagueWeek(leagueKey, week);
  if (!source) return null;
  if (completedWeek(source.matchups, week) == null) return null;
  const dossier = assembleDossier(source);
  const db = getDb();
  const previousRows = await db
    .select({ factSheet: articles.factSheet })
    .from(articles)
    .where(
      and(
        eq(articles.leagueKey, leagueKey),
        eq(articles.scope, "power-rankings"),
        eq(articles.status, "published"),
        lt(articles.week, week),
      ),
    )
    .orderBy(desc(articles.week))
    .limit(1);
  const notes = activityNotes(
    source.transactions.map((row) => ({
      type: row.type,
      status: row.status,
      timestamp: row.timestamp,
      faabBid: row.faabBid,
      players: row.players,
    })),
    source.weekStart,
    source.weekEnd,
  );
  const byTeam = new Map(dossier.teams.map((team) => [team.teamKey, team]));
  const ranked = scoreLeague({
    week,
    teams: dossier.teams.map((team) => ({
      teamKey: team.teamKey,
      teamName: team.teamName,
      managerName: team.managerName,
      yahooRank: team.yahooRank,
    })),
    games: source.matchups.map((row) => ({
      week: row.week,
      teamKey: row.teamKey,
      opponentTeamKey: row.opponentTeamKey,
      points: num(row.points),
      projectedPoints: num(row.projectedPoints),
      status: row.status,
    })),
    starters: dossier.teams.flatMap((team) =>
      team.lineup
        .filter((player) => player.role === "starter")
        .map((player) => ({
          teamKey: team.teamKey,
          seasonPoints: player.seasonPoints,
          weekPoints: player.weekPoints,
        })),
    ),
    previousOrder: orderFromFactSheet(previousRows[0]?.factSheet),
  });
  if (ranked.length === 0) return null;

  return {
    leagueKey,
    leagueName: dossier.leagueName,
    week,
    scoringType: dossier.league.scoringType,
    rosterSlots: dossier.league.rosterSlots,
    teams: ranked.map((team) => {
      const { powerScore: _powerScore, ...fact } = team;
      const extra = byTeam.get(team.teamKey);
      const row: RankingsTeamFact = {
        ...fact,
        note: notes.get(team.teamKey) ?? null,
        benchPoints: extra?.benchPoints ?? null,
        faabBalance: extra?.faabBalance ?? null,
        waiverPriority: extra?.waiverPriority ?? null,
        moves: extra?.moves ?? null,
        trades: extra?.trades ?? null,
        longestStreak: extra?.longestStreak,
        biggestWin: extra?.biggestWin ?? null,
        headToHead: extra?.headToHead ?? [],
        remainingOpponentNames: extra?.remainingOpponents ?? [],
        playoff: extra?.playoff ?? null,
        lineup: extra?.lineup ?? [],
        rankByWeek: extra?.rankByWeek ?? [],
      };
      return row;
    }),
  };
}

function orderFromFactSheet(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("teams" in value)) return [];
  const teams = value.teams;
  if (!Array.isArray(teams)) return [];
  return teams.flatMap((team) => {
    if (!team || typeof team !== "object" || !("teamKey" in team)) return [];
    return typeof team.teamKey === "string" ? [team.teamKey] : [];
  });
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
