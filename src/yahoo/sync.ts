import { YahooClient, type YahooResponse } from "./client";
import { extractGames, extractLeagues, extractPlayers, extractTeams, extractTransactions } from "./extract";
import { ingest } from "./ingest";

const POOL = 3;
const PLAYER_PAGE = 25;
const TRANSACTION_COUNT = 100;

async function mapPool<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) return;
      await worker(next);
    }
  });
  await Promise.all(runners);
}

function chunks<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function range(start: number, end: number) {
  const weeks: number[] = [];
  for (let week = start; week <= end; week += 1) weeks.push(week);
  return weeks;
}

async function fetchIngest(client: YahooClient, path: string): Promise<YahooResponse> {
  console.log(`fetch ${path}`);
  const response = await client.get(path);
  const known = await ingest(response.path, response.flat);
  if (!known) console.log(`stored ${response.path}; no normalized table for this path`);
  return response;
}

function playerKeys(flat: unknown) {
  return extractPlayers(flat).map((player) => player.playerKey);
}

export type NflSyncSummary = {
  leagues: number;
  message: string;
};

export async function syncCurrentNfl(): Promise<NflSyncSummary> {
  const client = new YahooClient();
  const game = await fetchIngest(client, "game/nfl");
  const gameKey = extractGames(game.flat)[0]?.gameKey;
  if (!gameKey) throw new Error("Yahoo did not return the current NFL game.");

  for (const path of [
    `game/${gameKey}/game_weeks`,
    `game/${gameKey}/stat_categories`,
    `game/${gameKey}/position_types`,
    `game/${gameKey}/roster_positions`,
  ]) {
    await fetchIngest(client, path);
  }

  const leagueResponse = await fetchIngest(client, "users;use_login=1/games;game_keys=nfl/leagues");
  await fetchIngest(client, "users;use_login=1/games;game_keys=nfl/teams");
  const leagues = extractLeagues(leagueResponse.flat);
  if (leagues.length === 0) {
    const message = "No NFL leagues for this Yahoo account. Game data is stored.";
    console.log(message);
    return { leagues: 0, message };
  }

  for (const league of leagues) {
    await syncLeague(client, league.leagueKey);
  }
  const message = `Synced ${leagues.length} NFL league${leagues.length === 1 ? "" : "s"}.`;
  console.log(message);
  return { leagues: leagues.length, message };
}

async function syncLeague(client: YahooClient, leagueKey: string) {
  console.log(`league ${leagueKey}`);
  const metadata = await fetchIngest(client, `league/${leagueKey}`);
  const league = extractLeagues(metadata.flat)[0];
  const startWeek = league?.startWeek && league.startWeek > 0 ? league.startWeek : 1;
  const currentWeek = league?.currentWeek ?? 0;
  const endWeek = league?.endWeek && league.endWeek > 0 ? league.endWeek : currentWeek;
  const playedThrough = currentWeek >= startWeek ? currentWeek : startWeek - 1;
  const scheduleThrough = Math.max(playedThrough, endWeek);
  const playedWeeks = playedThrough >= startWeek ? range(startWeek, playedThrough) : [];
  const scheduleWeeks = scheduleThrough >= startWeek ? range(startWeek, scheduleThrough) : [];

  await fetchIngest(client, `league/${leagueKey}/settings`);
  await fetchIngest(client, `league/${leagueKey}/standings`);
  const teamResponse = await fetchIngest(client, `league/${leagueKey}/teams`);
  const teamKeys = extractTeams(teamResponse.flat).map((team) => team.teamKey);
  await fetchIngest(client, `league/${leagueKey}/draftresults`);

  const trackedPlayers = new Set<string>();
  await syncCompletedTransactions(client, leagueKey, trackedPlayers);

  await mapPool(teamKeys, POOL, async (teamKey) => {
    const pending = await fetchIngest(
      client,
      `league/${leagueKey}/transactions;types=waiver,pending_trade;team_key=${teamKey}`,
    );
    for (const key of playerKeys(pending.flat)) trackedPlayers.add(key);
  });

  await mapPool(scheduleWeeks, POOL, async (week) => {
    await fetchIngest(client, `league/${leagueKey}/scoreboard;week=${week}`);
  });

  const rostered = new Map<number, Set<string>>();
  const rosterJobs = teamKeys.flatMap((teamKey) => playedWeeks.map((week) => ({ teamKey, week })));
  await mapPool(rosterJobs, POOL, async ({ teamKey, week }) => {
    const roster = await fetchIngest(
      client,
      `team/${teamKey}/roster;week=${week}/players;out=player_points`,
    );
    const keys = playerKeys(roster.flat);
    for (const key of keys) trackedPlayers.add(key);
    const bucket = rostered.get(week) ?? new Set<string>();
    if (!rostered.has(week)) rostered.set(week, bucket);
    for (const key of keys) bucket.add(key);
  });

  for (const week of playedWeeks) {
    const keys = [...(rostered.get(week) ?? [])];
    await mapPool(chunks(keys, PLAYER_PAGE), POOL, async (group) => {
      if (group.length === 0) return;
      await fetchIngest(
        client,
        `league/${leagueKey}/players;player_keys=${group.join(",")}/stats;type=week;week=${week}`,
      );
    });
  }

  await syncFreeAgents(client, leagueKey);
  const missing = [...trackedPlayers];
  await mapPool(chunks(missing, PLAYER_PAGE), POOL, async (keys) => {
    if (keys.length === 0) return;
    await fetchIngest(
      client,
      `league/${leagueKey}/players;player_keys=${keys.join(",")};out=ownership,percent_owned,stats`,
    );
  });
}

async function syncCompletedTransactions(client: YahooClient, leagueKey: string, trackedPlayers: Set<string>) {
  const seen = new Set<string>();
  for (let page = 0; page < 200; page += 1) {
    const start = page * TRANSACTION_COUNT;
    const response = await fetchIngest(
      client,
      `league/${leagueKey}/transactions;start=${start};count=${TRANSACTION_COUNT}`,
    );
    for (const key of playerKeys(response.flat)) trackedPlayers.add(key);
    const keys = extractTransactions(response.flat).map((row) => row.transactionKey);
    const fresh = keys.filter((key) => !seen.has(key));
    for (const key of keys) seen.add(key);
    if (fresh.length === 0 || keys.length < TRANSACTION_COUNT) return;
  }
}

async function syncFreeAgents(client: YahooClient, leagueKey: string) {
  const seen = new Set<string>();
  for (let page = 0; page < 200; page += 1) {
    const start = page * PLAYER_PAGE;
    const response = await fetchIngest(
      client,
      `league/${leagueKey}/players;status=A;start=${start};count=${PLAYER_PAGE};out=ownership,percent_owned,stats`,
    );
    const keys = playerKeys(response.flat);
    const fresh = keys.filter((key) => !seen.has(key));
    for (const key of keys) seen.add(key);
    if (fresh.length === 0 || keys.length < PLAYER_PAGE) return;
  }
}
