import { sql, type SQL } from "drizzle-orm";
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
import {
  extractDraftPicks,
  extractGameWeeks,
  extractGames,
  extractLeagues,
  extractMatchups,
  extractPlayers,
  extractStatCategories,
  extractSubtree,
  extractTeams,
  extractTransactions,
} from "./extract";
import { gameKeyFromPath, leagueKeyFromPath, teamKeyFromPath, weekFromPath } from "./parse";

type ResourceKind =
  | "game"
  | "game_weeks"
  | "stat_categories"
  | "position_types"
  | "roster_positions"
  | "user_leagues"
  | "user_teams"
  | "league"
  | "settings"
  | "standings"
  | "teams"
  | "draft"
  | "transactions"
  | "scoreboard"
  | "players"
  | "roster"
  | "team"
  | "player";

const ROUTES: Array<{ kind: ResourceKind; pattern: RegExp }> = [
  { kind: "game_weeks", pattern: /^game\/[^/]+\/game_weeks$/ },
  { kind: "stat_categories", pattern: /^game\/[^/]+\/stat_categories$/ },
  { kind: "position_types", pattern: /^game\/[^/]+\/position_types$/ },
  { kind: "roster_positions", pattern: /^game\/[^/]+\/roster_positions$/ },
  { kind: "game", pattern: /^game\/[^/]+$/ },
  { kind: "user_leagues", pattern: /^users;use_login=1\/games(?:;[^/]+)?\/leagues$/ },
  { kind: "user_teams", pattern: /^users;use_login=1\/games(?:;[^/]+)?\/teams$/ },
  { kind: "settings", pattern: /^league\/[^/]+\/settings$/ },
  { kind: "standings", pattern: /^league\/[^/]+\/standings$/ },
  { kind: "teams", pattern: /^league\/[^/]+\/teams$/ },
  { kind: "draft", pattern: /^league\/[^/]+\/draftresults$/ },
  { kind: "transactions", pattern: /^league\/[^/]+\/transactions(?:;.+)?$/ },
  { kind: "scoreboard", pattern: /^league\/[^/]+\/scoreboard(?:;.+)?$/ },
  { kind: "players", pattern: /^league\/[^/]+\/players(?:;.+)?(?:\/.+)?$/ },
  { kind: "league", pattern: /^league\/[^/]+$/ },
  { kind: "roster", pattern: /^team\/[^/]+\/roster(?:;[^/]*)?(?:\/players(?:;[^/]*)?)?$/ },
  { kind: "team", pattern: /^team\/[^/]+$/ },
  { kind: "player", pattern: /^players?(?:;.+)?(?:\/.+)?$/ },
];

export function classifyYahooPath(path: string): ResourceKind | null {
  return ROUTES.find((route) => route.pattern.test(path))?.kind ?? null;
}

function keep<T>(value: T | null | undefined, fallback: SQL): T | SQL {
  return value == null ? fallback : value;
}

function resolvedGameKey(path: string, flat: unknown) {
  return (
    extractGames(flat).find((game) => /^\d+$/.test(game.gameKey))?.gameKey ??
    gameKeyFromPath(path) ??
    extractGames(flat)[0]?.gameKey ??
    null
  );
}

export async function ingest(path: string, flat: unknown): Promise<boolean> {
  const kind = classifyYahooPath(path);
  if (!kind) return false;

  if (kind === "game" || kind === "game_weeks" || kind === "stat_categories") {
    await upsertGames(flat);
  }
  if (kind === "game_weeks") await upsertGameWeeks(path, flat);
  if (kind === "stat_categories") await upsertStatCategories(path, flat);
  if (kind === "position_types") await upsertGameJson(path, flat, "positionTypes", "position_types");
  if (kind === "roster_positions") {
    await upsertGameJson(path, flat, "rosterPositions", "roster_positions");
  }
  if (
    kind === "user_leagues" ||
    kind === "league" ||
    kind === "settings" ||
    kind === "standings" ||
    kind === "teams" ||
    kind === "scoreboard" ||
    kind === "players" ||
    kind === "draft" ||
    kind === "transactions"
  ) {
    await upsertLeagues(flat);
  }
  if (kind === "user_teams" || kind === "teams" || kind === "standings" || kind === "team") {
    await upsertTeams(flat);
  }
  if (kind === "standings" || kind === "team") await upsertStandings(flat);
  if (kind === "scoreboard") await upsertMatchups(flat);
  if (kind === "draft") await upsertDraftPicks(flat);
  if (kind === "transactions") await upsertTransactions(flat);
  if (kind === "players" || kind === "player" || kind === "roster" || kind === "transactions") {
    await upsertPlayers(flat, leagueKeyFromPath(path));
  }
  if (kind === "roster") await upsertRoster(path, flat);
  return true;
}

async function upsertGames(flat: unknown) {
  const db = getDb();
  for (const game of extractGames(flat)) {
    await db
      .insert(games)
      .values(game)
      .onConflictDoUpdate({
        target: games.gameKey,
        set: {
          gameId: keep(game.gameId, sql`${games.gameId}`),
          code: keep(game.code, sql`${games.code}`),
          season: keep(game.season, sql`${games.season}`),
          name: keep(game.name, sql`${games.name}`),
          type: keep(game.type, sql`${games.type}`),
          url: keep(game.url, sql`${games.url}`),
          isGameOver: keep(game.isGameOver, sql`${games.isGameOver}`),
          isOffseason: keep(game.isOffseason, sql`${games.isOffseason}`),
          isRegistrationOver: keep(game.isRegistrationOver, sql`${games.isRegistrationOver}`),
          raw: game.raw,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertGameWeeks(path: string, flat: unknown) {
  const gameKey = resolvedGameKey(path, flat);
  if (!gameKey) return;
  const db = getDb();
  for (const week of extractGameWeeks(flat)) {
    await db
      .insert(gameWeeks)
      .values({ gameKey, ...week })
      .onConflictDoUpdate({
        target: [gameWeeks.gameKey, gameWeeks.week],
        set: {
          startDate: keep(week.startDate, sql`${gameWeeks.startDate}`),
          endDate: keep(week.endDate, sql`${gameWeeks.endDate}`),
          raw: week.raw,
        },
      });
  }
}

async function upsertStatCategories(path: string, flat: unknown) {
  const gameKey = resolvedGameKey(path, flat);
  if (!gameKey) return;
  const db = getDb();
  for (const stat of extractStatCategories(flat)) {
    await db
      .insert(statCategories)
      .values({ gameKey, ...stat })
      .onConflictDoUpdate({
        target: [statCategories.gameKey, statCategories.statId],
        set: {
          name: keep(stat.name, sql`${statCategories.name}`),
          displayName: keep(stat.displayName, sql`${statCategories.displayName}`),
          positionType: keep(stat.positionType, sql`${statCategories.positionType}`),
          sortOrder: keep(stat.sortOrder, sql`${statCategories.sortOrder}`),
          raw: stat.raw,
        },
      });
  }
}

async function upsertGameJson(
  path: string,
  flat: unknown,
  column: "positionTypes" | "rosterPositions",
  key: string,
) {
  const gameKey = resolvedGameKey(path, flat);
  if (!gameKey) return;
  const value = extractSubtree(flat, key) ?? null;
  await getDb()
    .insert(games)
    .values({
      gameKey,
      [column]: value,
      raw: { game_key: gameKey },
    })
    .onConflictDoUpdate({
      target: games.gameKey,
      set: {
        [column]: value,
        updatedAt: new Date(),
      },
    });
}

async function upsertLeagues(flat: unknown) {
  const db = getDb();
  for (const league of extractLeagues(flat)) {
    await db
      .insert(leagues)
      .values(league)
      .onConflictDoUpdate({
        target: leagues.leagueKey,
        set: {
          gameKey: league.gameKey,
          leagueId: keep(league.leagueId, sql`${leagues.leagueId}`),
          name: keep(league.name, sql`${leagues.name}`),
          url: keep(league.url, sql`${leagues.url}`),
          draftStatus: keep(league.draftStatus, sql`${leagues.draftStatus}`),
          numTeams: keep(league.numTeams, sql`${leagues.numTeams}`),
          scoringType: keep(league.scoringType, sql`${leagues.scoringType}`),
          leagueType: keep(league.leagueType, sql`${leagues.leagueType}`),
          currentWeek: keep(league.currentWeek, sql`${leagues.currentWeek}`),
          startWeek: keep(league.startWeek, sql`${leagues.startWeek}`),
          endWeek: keep(league.endWeek, sql`${leagues.endWeek}`),
          settings: keep(league.settings, sql`${leagues.settings}`),
          raw: league.raw,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertTeams(flat: unknown) {
  const db = getDb();
  for (const team of extractTeams(flat)) {
    if (!team.name && !team.teamId) continue;
    const row = {
      teamKey: team.teamKey,
      leagueKey: team.leagueKey,
      teamId: team.teamId,
      name: team.name,
      url: team.url,
      waiverPriority: team.waiverPriority,
      faabBalance: team.faabBalance,
      numberOfMoves: team.numberOfMoves,
      numberOfTrades: team.numberOfTrades,
      logoUrl: team.logoUrl,
      managers: team.managers,
      raw: team.raw,
    };
    await db
      .insert(teams)
      .values(row)
      .onConflictDoUpdate({
        target: teams.teamKey,
        set: {
          leagueKey: team.leagueKey,
          teamId: keep(team.teamId, sql`${teams.teamId}`),
          name: keep(team.name, sql`${teams.name}`),
          url: keep(team.url, sql`${teams.url}`),
          waiverPriority: keep(team.waiverPriority, sql`${teams.waiverPriority}`),
          faabBalance: keep(team.faabBalance, sql`${teams.faabBalance}`),
          numberOfMoves: keep(team.numberOfMoves, sql`${teams.numberOfMoves}`),
          numberOfTrades: keep(team.numberOfTrades, sql`${teams.numberOfTrades}`),
          logoUrl: keep(team.logoUrl, sql`${teams.logoUrl}`),
          managers: keep(team.managers, sql`${teams.managers}`),
          raw: team.raw,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertStandings(flat: unknown) {
  const db = getDb();
  for (const team of extractTeams(flat)) {
    if (!team.standings) continue;
    await db
      .insert(teamStandings)
      .values({
        teamKey: team.teamKey,
        leagueKey: team.leagueKey,
        ...team.standings,
      })
      .onConflictDoUpdate({
        target: teamStandings.teamKey,
        set: {
          leagueKey: team.leagueKey,
          rank: team.standings.rank,
          wins: team.standings.wins,
          losses: team.standings.losses,
          ties: team.standings.ties,
          percentage: team.standings.percentage,
          pointsFor: team.standings.pointsFor,
          pointsAgainst: team.standings.pointsAgainst,
          raw: team.standings.raw,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertMatchups(flat: unknown) {
  const db = getDb();
  for (const matchup of extractMatchups(flat)) {
    await db
      .insert(matchups)
      .values(matchup)
      .onConflictDoUpdate({
        target: [matchups.leagueKey, matchups.week, matchups.teamKey],
        set: {
          opponentTeamKey: matchup.opponentTeamKey,
          points: matchup.points,
          projectedPoints: matchup.projectedPoints,
          isWinner: matchup.isWinner,
          status: matchup.status,
          raw: matchup.raw,
        },
      });
  }
}

async function upsertDraftPicks(flat: unknown) {
  const db = getDb();
  for (const pick of extractDraftPicks(flat)) {
    await db
      .insert(draftPicks)
      .values(pick)
      .onConflictDoUpdate({
        target: [draftPicks.leagueKey, draftPicks.pick],
        set: {
          round: pick.round,
          teamKey: pick.teamKey,
          playerKey: pick.playerKey,
          raw: pick.raw,
        },
      });
  }
}

async function upsertTransactions(flat: unknown) {
  const db = getDb();
  for (const transaction of extractTransactions(flat)) {
    await db
      .insert(transactions)
      .values(transaction)
      .onConflictDoUpdate({
        target: transactions.transactionKey,
        set: {
          leagueKey: transaction.leagueKey,
          type: transaction.type,
          status: transaction.status,
          timestamp: transaction.timestamp,
          faabBid: transaction.faabBid,
          players: transaction.players,
          raw: transaction.raw,
        },
      });
  }
}

async function upsertPlayers(flat: unknown, leagueKey: string | null) {
  const db = getDb();
  for (const player of extractPlayers(flat)) {
    if (player.name || player.displayPosition || player.nflTeam || player.playerId) {
      const row = {
        playerKey: player.playerKey,
        gameKey: player.gameKey,
        playerId: player.playerId,
        name: player.name,
        firstName: player.firstName,
        lastName: player.lastName,
        nflTeam: player.nflTeam,
        displayPosition: player.displayPosition,
        positions: player.positions,
        status: player.status,
        injuryNote: player.injuryNote,
        raw: player.raw,
      };
      await db
        .insert(players)
        .values(row)
        .onConflictDoUpdate({
          target: players.playerKey,
          set: {
            gameKey: keep(player.gameKey, sql`${players.gameKey}`),
            playerId: keep(player.playerId, sql`${players.playerId}`),
            name: keep(player.name, sql`${players.name}`),
            firstName: keep(player.firstName, sql`${players.firstName}`),
            lastName: keep(player.lastName, sql`${players.lastName}`),
            nflTeam: keep(player.nflTeam, sql`${players.nflTeam}`),
            displayPosition: keep(player.displayPosition, sql`${players.displayPosition}`),
            positions: keep(player.positions, sql`${players.positions}`),
            status: keep(player.status, sql`${players.status}`),
            injuryNote: keep(player.injuryNote, sql`${players.injuryNote}`),
            raw: player.raw,
            updatedAt: new Date(),
          },
        });
    }

    if (!leagueKey || (!player.hasOwnership && !player.hasSeasonStats)) continue;
    await db
      .insert(playerOwnership)
      .values({
        leagueKey,
        playerKey: player.playerKey,
        ownershipType: player.ownershipType,
        teamKey: player.ownerTeamKey,
        percentOwned: player.percentOwned,
        seasonPoints: player.seasonPoints,
        seasonStats: player.seasonStats,
        raw: player.raw,
      })
      .onConflictDoUpdate({
        target: [playerOwnership.leagueKey, playerOwnership.playerKey],
        set: {
          ownershipType: player.hasOwnership
            ? player.ownershipType
            : sql`${playerOwnership.ownershipType}`,
          teamKey: player.hasOwnership ? player.ownerTeamKey : sql`${playerOwnership.teamKey}`,
          percentOwned: keep(player.percentOwned, sql`${playerOwnership.percentOwned}`),
          seasonPoints: player.hasSeasonStats
            ? player.seasonPoints
            : sql`${playerOwnership.seasonPoints}`,
          seasonStats: player.hasSeasonStats
            ? player.seasonStats
            : sql`${playerOwnership.seasonStats}`,
          raw: player.raw,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertRoster(path: string, flat: unknown) {
  const teamKey = teamKeyFromPath(path);
  const leagueKey = leagueKeyFromPath(path);
  const week = weekFromPath(path);
  if (!teamKey || !leagueKey || week == null) return;
  const db = getDb();
  for (const player of extractPlayers(flat)) {
    await db
      .insert(rosterEntries)
      .values({
        leagueKey,
        teamKey,
        week,
        playerKey: player.playerKey,
        selectedPosition: player.selectedPosition,
        raw: player.raw,
      })
      .onConflictDoUpdate({
        target: [
          rosterEntries.leagueKey,
          rosterEntries.teamKey,
          rosterEntries.week,
          rosterEntries.playerKey,
        ],
        set: {
          selectedPosition: keep(player.selectedPosition, sql`${rosterEntries.selectedPosition}`),
          raw: player.raw,
        },
      });
  }
}
