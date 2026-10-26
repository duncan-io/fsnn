import { and, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  draftPicks,
  gameWeeks,
  games,
  leagues,
  matchups,
  playerOwnership,
  players,
  rosterEntries,
  statCategories,
  teamStandings,
  teams,
  transactions,
} from "../db/schema";
import { completedWeek, managerName, playerWeekPoints } from "../recap/brief";
import { rewindActivity, seasonPointsThrough, type PlayerWeekScore } from "./asof";
import type { BriefInput, BriefMatchupRow, BriefTransactionRow } from "../recap/types";
import { benchPoints, isBenchSlot, starterPoints } from "./lineup";
import { seasonMemory, type MemoryGame } from "./memory";
import { labelStats, parseWeekStats, playoffTeamCount, rosterSlots } from "./stats";
import type { LineupPlayer, StatLine, TeamFacts, WeekDossier } from "./types";

export type DossierRoster = {
  teamKey: string;
  playerKey: string;
  playerName: string | null;
  displayPosition: string | null;
  selectedPosition: string | null;
  nflTeam: string | null;
  injuryStatus: string | null;
  injuryNote: string | null;
  percentOwned: number | null;
  seasonPoints: number | null;
  weekPoints: number | null;
  weekStats: StatLine[];
  draftRound: number | null;
  draftPick: number | null;
};

export type DossierTeam = {
  teamKey: string;
  name: string;
  managers: unknown;
  faabBalance: number | null;
  waiverPriority: number | null;
  moves: number | null;
  trades: number | null;
  yahooRank: number | null;
};

export type DossierSource = {
  leagueKey: string;
  leagueName: string;
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  scoringType: string | null;
  rosterSlots: string[];
  playoffTeams: number | null;
  endWeek: number | null;
  teams: DossierTeam[];
  matchups: BriefMatchupRow[];
  rosters: DossierRoster[];
  transactions: BriefTransactionRow[];
  asOfLatest: boolean;
  playerScores: PlayerWeekScore[];
};

export async function loadLeagueWeek(leagueKey: string, week: number): Promise<DossierSource | null> {
  const db = getDb();
  const [league] = await db.select().from(leagues).where(eq(leagues.leagueKey, leagueKey));
  if (!league) return null;
  const [weekRow, teamRows, standingRows, matchupRows, rosterRows, transactionRows, pickRows, categoryRows, gameRows] =
    await Promise.all([
      db
        .select()
        .from(gameWeeks)
        .where(and(eq(gameWeeks.gameKey, league.gameKey), eq(gameWeeks.week, week)))
        .then((rows) => rows[0]),
      db.select().from(teams).where(eq(teams.leagueKey, leagueKey)),
      db.select().from(teamStandings).where(eq(teamStandings.leagueKey, leagueKey)),
      db.select().from(matchups).where(eq(matchups.leagueKey, leagueKey)),
      db
        .select()
        .from(rosterEntries)
        .where(and(eq(rosterEntries.leagueKey, leagueKey), eq(rosterEntries.week, week))),
      db.select().from(transactions).where(eq(transactions.leagueKey, leagueKey)),
      db.select().from(draftPicks).where(eq(draftPicks.leagueKey, leagueKey)),
      db.select().from(statCategories).where(eq(statCategories.gameKey, league.gameKey)),
      db.select().from(games).where(eq(games.gameKey, league.gameKey)),
    ]);
  const playerKeys = [...new Set(rosterRows.map((row) => row.playerKey))];
  const [playerRows, ownershipRows] =
    playerKeys.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(players).where(inArray(players.playerKey, playerKeys)),
          db
            .select()
            .from(playerOwnership)
            .where(and(eq(playerOwnership.leagueKey, leagueKey), inArray(playerOwnership.playerKey, playerKeys))),
        ]);
  const playerByKey = new Map(playerRows.map((player) => [player.playerKey, player]));
  const ownershipByKey = new Map(ownershipRows.map((row) => [row.playerKey, row]));
  const labels = new Map(
    categoryRows.flatMap((row) => {
      const label = row.displayName?.trim() || row.name?.trim();
      return label ? [[row.statId, label] as const] : [];
    }),
  );
  const picks = new Map(
    pickRows.flatMap((row) => (row.playerKey ? [[row.playerKey, row] as const] : [])),
  );
  const standings = new Map(standingRows.map((row) => [row.teamKey, row.rank]));
  const latest = completedWeek(matchupRows);
  const asOfLatest = latest == null || week >= latest;
  const playerScores = asOfLatest
    ? []
    : (
        await db
          .select({
            playerKey: rosterEntries.playerKey,
            week: rosterEntries.week,
            raw: rosterEntries.raw,
          })
          .from(rosterEntries)
          .where(and(eq(rosterEntries.leagueKey, leagueKey), lte(rosterEntries.week, week)))
      ).map((row) => ({
        playerKey: row.playerKey,
        week: row.week,
        points: playerWeekPoints(row.raw),
      }));

  return {
    leagueKey,
    leagueName: league.name?.trim() || leagueKey,
    week,
    weekStart: weekRow?.startDate ?? null,
    weekEnd: weekRow?.endDate ?? null,
    scoringType: league.scoringType,
    rosterSlots: rosterSlots(gameRows[0]?.rosterPositions),
    playoffTeams: playoffTeamCount(league.settings),
    endWeek: league.endWeek,
    teams: teamRows.map((team) => ({
      teamKey: team.teamKey,
      name: team.name?.trim() || team.teamKey,
      managers: team.managers,
      faabBalance: team.faabBalance,
      waiverPriority: team.waiverPriority,
      moves: team.numberOfMoves,
      trades: team.numberOfTrades,
      yahooRank: standings.get(team.teamKey) ?? null,
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
      const ownership = ownershipByKey.get(row.playerKey);
      const pick = picks.get(row.playerKey);
      const stats = parseWeekStats(row.weekStats);
      return {
        teamKey: row.teamKey,
        playerKey: row.playerKey,
        playerName: player?.name ?? nameFromRaw(row.raw),
        displayPosition: player?.displayPosition ?? null,
        selectedPosition: row.selectedPosition,
        nflTeam: player?.nflTeam ?? null,
        injuryStatus: player?.status ?? null,
        injuryNote: player?.injuryNote ?? null,
        percentOwned: num(ownership?.percentOwned),
        seasonPoints: num(ownership?.seasonPoints),
        weekPoints: playerWeekPoints(row.raw),
        weekStats: labelStats(stats, labels),
        draftRound: pick?.round ?? null,
        draftPick: pick?.pick ?? null,
        labeledStats: labelStats(stats, labels),
      };
    }),
    transactions: transactionRows.map((row) => ({
      type: row.type,
      status: row.status,
      timestamp: row.timestamp,
      faabBid: row.faabBid,
      players: row.players,
    })),
    asOfLatest,
    playerScores,
  };
}

export function assembleDossier(source: DossierSource): WeekDossier {
  const games: MemoryGame[] = source.matchups.map((row) => ({
    week: row.week,
    teamKey: row.teamKey,
    opponentTeamKey: row.opponentTeamKey,
    points: num(row.points),
    status: row.status,
  }));
  const rewound = source.asOfLatest
    ? null
    : rewindActivity(
        source.teams.map((team) => ({
          teamKey: team.teamKey,
          faabBalance: team.faabBalance,
          moves: team.moves,
          trades: team.trades,
        })),
        source.transactions,
        source.weekEnd,
      );
  const seasonTotals = source.asOfLatest ? null : seasonPointsThrough(source.playerScores, source.week);
  const memory = seasonMemory(
    source.teams.map((team) => ({ teamKey: team.teamKey, teamName: team.name })),
    games,
    source.week,
    source.playoffTeams,
    source.endWeek,
  );
  const lineups = new Map<string, LineupPlayer[]>();
  for (const roster of source.rosters) {
    if (!roster.playerName) continue;
    const list = lineups.get(roster.teamKey) ?? [];
    const role = isBenchSlot(roster.selectedPosition) ? "bench" : "starter";
    list.push({
      playerKey: roster.playerKey,
      name: roster.playerName,
      nflTeam: roster.nflTeam,
      position: roster.displayPosition,
      slot: roster.selectedPosition,
      role,
      weekPoints: roster.weekPoints,
      injuryStatus: source.asOfLatest ? roster.injuryStatus : null,
      injuryNote: source.asOfLatest ? roster.injuryNote : null,
      percentOwned: source.asOfLatest ? roster.percentOwned : null,
      seasonPoints: seasonTotals ? (seasonTotals.get(roster.playerKey) ?? null) : roster.seasonPoints,
      weekStats: roster.weekStats,
      draftRound: roster.draftRound,
      draftPick: roster.draftPick,
    });
    lineups.set(roster.teamKey, list);
  }
  for (const [teamKey, list] of lineups) {
    lineups.set(
      teamKey,
      list.sort((a, b) => {
        if (a.role !== b.role) return a.role === "starter" ? -1 : 1;
        return (b.weekPoints ?? -1) - (a.weekPoints ?? -1) || a.name.localeCompare(b.name);
      }),
    );
  }
  const teams: TeamFacts[] = source.teams.map((team) => {
    const lineup = lineups.get(team.teamKey) ?? [];
    const remembered = memory.get(team.teamKey);
    const activity = rewound?.get(team.teamKey);
    return {
      teamKey: team.teamKey,
      teamName: team.name,
      managerName: managerName(team.managers),
      yahooRank: source.asOfLatest ? team.yahooRank : (remembered?.rankByWeek.at(-1)?.rank ?? null),
      faabBalance: activity ? activity.faabBalance : team.faabBalance,
      waiverPriority: source.asOfLatest ? team.waiverPriority : null,
      moves: activity ? activity.moves : team.moves,
      trades: activity ? activity.trades : team.trades,
      lineup,
      benchPoints: benchPoints(lineup),
      weekStarterPoints: starterPoints(lineup),
      rankByWeek: remembered?.rankByWeek ?? [],
      longestStreak: remembered?.longestStreak ?? "",
      biggestWin: remembered?.biggestWin ?? null,
      headToHead: remembered?.headToHead ?? [],
      remainingOpponents: remembered?.remainingOpponents ?? [],
      playoff: remembered?.playoff ?? null,
      weekResult: remembered?.weekResult ?? null,
    };
  });
  teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
  return {
    leagueKey: source.leagueKey,
    leagueName: source.leagueName,
    week: source.week,
    weekStart: source.weekStart,
    weekEnd: source.weekEnd,
    league: {
      scoringType: source.scoringType,
      rosterSlots: source.rosterSlots,
      playoffTeams: source.playoffTeams,
      endWeek: source.endWeek,
    },
    teams,
  };
}

export function toBriefInput(source: DossierSource): BriefInput {
  return {
    leagueKey: source.leagueKey,
    leagueName: source.leagueName,
    week: source.week,
    weekStart: source.weekStart,
    weekEnd: source.weekEnd,
    teams: source.teams.map((team) => ({
      teamKey: team.teamKey,
      name: team.name,
      managers: team.managers,
    })),
    matchups: source.matchups,
    rosters: source.rosters.map((roster) => ({
      teamKey: roster.teamKey,
      week: source.week,
      playerKey: roster.playerKey,
      playerName: roster.playerName,
      displayPosition: roster.displayPosition,
      selectedPosition: roster.selectedPosition,
      raw: roster.weekPoints == null ? {} : { player_points: { total: roster.weekPoints } },
    })),
    transactions: source.transactions,
  };
}

export async function loadWeekDossier(leagueKey: string, week: number): Promise<WeekDossier | null> {
  const source = await loadLeagueWeek(leagueKey, week);
  return source ? assembleDossier(source) : null;
}

function nameFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || !("name" in raw)) return null;
  const name = raw.name;
  if (typeof name === "string") return name;
  if (name && typeof name === "object" && "full" in name && typeof name.full === "string") return name.full;
  return null;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

