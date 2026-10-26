import type { BriefTransactionRow } from "../recap/types";

export type TeamActivity = {
  teamKey: string;
  faabBalance: number | null;
  moves: number | null;
  trades: number | null;
};

export type RewoundTeam = {
  faabBalance: number | null;
  moves: number | null;
  trades: number | null;
};

export type PlayerWeekScore = {
  playerKey: string;
  week: number;
  points: number | null;
};

type MovePlayer = {
  type: string | null;
  sourceTeamKey: string | null;
  destinationTeamKey: string | null;
};

export function rewindActivity(
  teams: TeamActivity[],
  transactions: BriefTransactionRow[],
  weekEnd: string | null,
): Map<string, RewoundTeam> {
  const faab = new Map<string, number>();
  const moves = new Map<string, number>();
  const trades = new Map<string, number>();
  for (const team of teams) {
    if (team.faabBalance != null) faab.set(team.teamKey, team.faabBalance);
    if (team.moves != null) moves.set(team.teamKey, team.moves);
    if (team.trades != null) trades.set(team.teamKey, team.trades);
  }
  if (weekEnd) {
    for (const row of transactions) {
      if (row.status !== "successful" || !row.timestamp) continue;
      if (row.timestamp.toISOString().slice(0, 10) <= weekEnd) continue;
      undoTransaction(row, faab, moves, trades);
    }
  }
  const result = new Map<string, RewoundTeam>();
  for (const team of teams) {
    result.set(team.teamKey, {
      faabBalance: floored(faab, team.teamKey),
      moves: floored(moves, team.teamKey),
      trades: floored(trades, team.teamKey),
    });
  }
  return result;
}

export function seasonPointsThrough(scores: PlayerWeekScore[], throughWeek: number): Map<string, number> {
  const best = new Map<string, number>();
  for (const score of scores) {
    if (score.week > throughWeek || score.points == null) continue;
    const key = `${score.playerKey}:${score.week}`;
    const current = best.get(key);
    if (current == null || score.points > current) best.set(key, score.points);
  }
  const totals = new Map<string, number>();
  for (const [key, points] of best) {
    const playerKey = key.slice(0, key.lastIndexOf(":"));
    totals.set(playerKey, round((totals.get(playerKey) ?? 0) + points));
  }
  return totals;
}

function undoTransaction(
  row: BriefTransactionRow,
  faab: Map<string, number>,
  moves: Map<string, number>,
  trades: Map<string, number>,
) {
  const players = movePlayers(row.players);
  if (row.type === "trade") {
    const involved = new Set<string>();
    for (const player of players) {
      if (player.sourceTeamKey) involved.add(player.sourceTeamKey);
      if (player.destinationTeamKey) involved.add(player.destinationTeamKey);
    }
    for (const teamKey of involved) decrement(trades, teamKey);
    return;
  }
  let refunded = false;
  for (const player of players) {
    if (player.type === "add" || player.type === "drop") {
      const teamKey = player.type === "add" ? player.destinationTeamKey : player.sourceTeamKey;
      if (teamKey) decrement(moves, teamKey);
    }
    if (refunded || player.type !== "add" || !player.destinationTeamKey) continue;
    if (row.faabBid == null || row.faabBid <= 0) continue;
    if (!faab.has(player.destinationTeamKey)) continue;
    faab.set(player.destinationTeamKey, (faab.get(player.destinationTeamKey) ?? 0) + row.faabBid);
    refunded = true;
  }
}

function movePlayers(players: unknown): MovePlayer[] {
  if (!Array.isArray(players)) return [];
  return players.flatMap((player) => {
    if (!player || typeof player !== "object") return [];
    const row = player as Record<string, unknown>;
    return [
      {
        type: typeof row.type === "string" ? row.type : null,
        sourceTeamKey: typeof row.sourceTeamKey === "string" ? row.sourceTeamKey : null,
        destinationTeamKey: typeof row.destinationTeamKey === "string" ? row.destinationTeamKey : null,
      },
    ];
  });
}

function decrement(totals: Map<string, number>, teamKey: string) {
  if (!totals.has(teamKey)) return;
  totals.set(teamKey, (totals.get(teamKey) ?? 0) - 1);
}

function floored(totals: Map<string, number>, teamKey: string): number | null {
  if (!totals.has(teamKey)) return null;
  return Math.max(0, totals.get(teamKey) ?? 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
