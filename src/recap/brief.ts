import type {
  BriefInput,
  BriefMatchup,
  BriefMatchupRow,
  BriefPerformer,
  BriefRosterRow,
  BriefSide,
  BriefTeamRow,
  BriefTransaction,
  BriefTransactionRow,
  RecapRecord,
  WeekBrief,
} from "./types";

const BENCH = new Set(["BN", "IR", "IR-R", "RES", "NA", "TAXI"]);

type Standing = {
  teamKey: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  results: Array<"W" | "L" | "T">;
};

export function completedWeek(
  rows: Array<{ week: number; status: string | null }>,
  requestedWeek?: number,
): number | null {
  const byWeek = new Map<number, Array<string | null>>();
  for (const row of rows) {
    const statuses = byWeek.get(row.week) ?? [];
    statuses.push(row.status);
    byWeek.set(row.week, statuses);
  }
  const complete = [...byWeek.entries()]
    .filter(([, statuses]) => statuses.length > 0 && statuses.every((status) => status === "postevent"))
    .map(([week]) => week)
    .sort((a, b) => a - b);
  if (requestedWeek != null) return complete.includes(requestedWeek) ? requestedWeek : null;
  return complete.at(-1) ?? null;
}

export function inWeekWindow(timestamp: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const day = timestamp.toISOString().slice(0, 10);
  return day >= start && day <= end;
}

export function managerName(managers: unknown): string | null {
  if (!Array.isArray(managers)) return null;
  for (const manager of managers) {
    if (!manager || typeof manager !== "object" || !("nickname" in manager)) continue;
    const nickname = manager.nickname;
    if (typeof nickname === "string" && nickname.trim()) return nickname.trim();
  }
  return null;
}

export function playerWeekPoints(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || !("player_points" in raw)) return null;
  const points = raw.player_points;
  if (!points || typeof points !== "object" || !("total" in points)) return null;
  const total = points.total;
  if (typeof total === "number" && Number.isFinite(total)) return roundPoints(total);
  if (typeof total === "string" && total.trim()) {
    const value = Number(total);
    return Number.isFinite(value) ? roundPoints(value) : null;
  }
  return null;
}

export function buildWeekBrief(input: BriefInput): WeekBrief {
  const teams = new Map(input.teams.map((team) => [team.teamKey, team]));
  const before = standingsThrough(input, input.week - 1, teams);
  const after = standingsThrough(input, input.week, teams);
  const rankBefore = ranks(before);
  const rankAfter = ranks(after);
  const performers = performersByTeam(input.rosters, input.week);

  const matchups = pairWeek(input.matchups, input.week).map((pair) => {
    const home = side(pair.home, teams, after, rankBefore, rankAfter, performers);
    const away = side(pair.away, teams, after, rankBefore, rankAfter, performers);
    const tied = home.points === away.points;
    const [winner, loser] = tied
      ? [home, away].sort((a, b) => a.teamName.localeCompare(b.teamName))
      : home.points > away.points
        ? [home, away]
        : [away, home];
    return {
      matchupKey: pair.matchupKey,
      result: tied ? "tie" : "win",
      margin: roundPoints(Math.abs(home.points - away.points)),
      winner,
      loser,
    } satisfies BriefMatchup;
  });
  matchups.sort((a, b) => b.margin - a.margin || a.matchupKey.localeCompare(b.matchupKey));

  return {
    leagueKey: input.leagueKey,
    leagueName: input.leagueName,
    week: input.week,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    matchups,
    transactions: transactionsInWindow(input.transactions, input.weekStart, input.weekEnd, teams),
  };
}

function side(
  row: BriefMatchupRow,
  teams: Map<string, BriefTeamRow>,
  after: Map<string, Standing>,
  rankBefore: Map<string, number>,
  rankAfter: Map<string, number>,
  performers: Map<string, BriefPerformer[]>,
): BriefSide {
  const team = teams.get(row.teamKey);
  const current = after.get(row.teamKey);
  const points = numberOrZero(row.points);
  const projected = row.projectedPoints == null ? null : numberOrZero(row.projectedPoints);
  return {
    teamKey: row.teamKey,
    teamName: team?.name ?? row.teamKey,
    managerName: managerName(team?.managers),
    points,
    projectedPoints: projected,
    projectionDelta: projected == null ? null : roundPoints(points - projected),
    record: recordOf(current),
    rankBefore: rankBefore.get(row.teamKey) ?? 1,
    rankAfter: rankAfter.get(row.teamKey) ?? 1,
    streak: streakOf(current?.results ?? []),
    pointsFor: current?.pointsFor ?? 0,
    pointsAgainst: current?.pointsAgainst ?? 0,
    topPerformers: performers.get(row.teamKey) ?? [],
  };
}

function recordOf(standing: Standing | undefined): RecapRecord {
  return {
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    ties: standing?.ties ?? 0,
  };
}

function standingsThrough(input: BriefInput, week: number, teams: Map<string, BriefTeamRow>) {
  const table = new Map<string, Standing>();
  for (const team of teams.values()) {
    table.set(team.teamKey, {
      teamKey: team.teamKey,
      teamName: team.name,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      results: [],
    });
  }
  const weeks = [...new Set(input.matchups.map((row) => row.week))]
    .filter((value) => value <= week)
    .sort((a, b) => a - b);
  for (const value of weeks) {
    for (const pair of pairWeek(input.matchups, value)) {
      applyResult(table, pair.home, pair.away);
    }
  }
  return table;
}

function applyResult(table: Map<string, Standing>, home: BriefMatchupRow, away: BriefMatchupRow) {
  if (home.status !== "postevent" || away.status !== "postevent") return;
  const homePoints = numberOrZero(home.points);
  const awayPoints = numberOrZero(away.points);
  const homeStanding = table.get(home.teamKey);
  const awayStanding = table.get(away.teamKey);
  if (!homeStanding || !awayStanding) return;
  homeStanding.pointsFor = roundPoints(homeStanding.pointsFor + homePoints);
  homeStanding.pointsAgainst = roundPoints(homeStanding.pointsAgainst + awayPoints);
  awayStanding.pointsFor = roundPoints(awayStanding.pointsFor + awayPoints);
  awayStanding.pointsAgainst = roundPoints(awayStanding.pointsAgainst + homePoints);
  if (homePoints === awayPoints) {
    homeStanding.ties += 1;
    awayStanding.ties += 1;
    homeStanding.results.push("T");
    awayStanding.results.push("T");
    return;
  }
  const homeWon = homePoints > awayPoints;
  homeStanding.wins += homeWon ? 1 : 0;
  homeStanding.losses += homeWon ? 0 : 1;
  awayStanding.wins += homeWon ? 0 : 1;
  awayStanding.losses += homeWon ? 1 : 0;
  homeStanding.results.push(homeWon ? "W" : "L");
  awayStanding.results.push(homeWon ? "L" : "W");
}

function ranks(table: Map<string, Standing>) {
  const ordered = [...table.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamName.localeCompare(b.teamName);
  });
  const rank = new Map<string, number>();
  ordered.forEach((standing, index) => {
    const previous = ordered[index - 1];
    if (
      previous &&
      previous.wins === standing.wins &&
      previous.pointsFor === standing.pointsFor
    ) {
      rank.set(standing.teamKey, rank.get(previous.teamKey) ?? index + 1);
      return;
    }
    rank.set(standing.teamKey, index + 1);
  });
  return rank;
}

function pairWeek(rows: BriefMatchupRow[], week: number) {
  const groups = new Map<string, BriefMatchupRow[]>();
  for (const row of rows) {
    if (row.week !== week || !row.opponentTeamKey) continue;
    const matchupKey = [row.teamKey, row.opponentTeamKey].sort().join(":");
    const group = groups.get(matchupKey) ?? [];
    group.push(row);
    groups.set(matchupKey, group);
  }
  return [...groups.entries()].flatMap(([matchupKey, group]) => {
    const home = group[0];
    const away = home ? group.find((row) => row.teamKey === home.opponentTeamKey) : undefined;
    if (!home || !away) return [];
    return [{ matchupKey, home, away }];
  });
}

function performersByTeam(rosters: BriefRosterRow[], week: number) {
  const byTeam = new Map<string, BriefPerformer[]>();
  for (const roster of rosters) {
    if (roster.week !== week) continue;
    if (roster.selectedPosition && BENCH.has(roster.selectedPosition.toUpperCase())) continue;
    const points = playerWeekPoints(roster.raw);
    if (points == null || !roster.playerName) continue;
    const list = byTeam.get(roster.teamKey) ?? [];
    list.push({
      name: roster.playerName,
      position: roster.displayPosition,
      points,
      selectedPosition: roster.selectedPosition,
    });
    byTeam.set(roster.teamKey, list);
  }
  for (const [teamKey, list] of byTeam) {
    byTeam.set(
      teamKey,
      list.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, 3),
    );
  }
  return byTeam;
}

function transactionsInWindow(
  rows: BriefTransactionRow[],
  start: string | null,
  end: string | null,
  teams: Map<string, BriefTeamRow>,
): BriefTransaction[] {
  return rows.flatMap((row) => {
    if (!row.timestamp || !inWeekWindow(row.timestamp, start, end)) return [];
    const players = Array.isArray(row.players) ? row.players : [];
    return [
      {
        type: row.type,
        status: row.status,
        timestamp: row.timestamp.toISOString(),
        faabBid: row.faabBid,
        players: players.flatMap((player) => {
          if (!player || typeof player !== "object") return [];
          const record = player as Record<string, unknown>;
          const name = typeof record.name === "string" ? record.name : null;
          const action = typeof record.type === "string" ? record.type : null;
          return [
            {
              name,
              action,
              sourceTeamName: teamName(teams, record.sourceTeamKey),
              destinationTeamName: teamName(teams, record.destinationTeamKey),
            },
          ];
        }),
      },
    ];
  });
}

function teamName(teams: Map<string, BriefTeamRow>, key: unknown) {
  if (typeof key !== "string") return null;
  return teams.get(key)?.name ?? null;
}

function streakOf(results: Array<"W" | "L" | "T">): string {
  const latest = results.at(-1);
  if (!latest) return "";
  let count = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== latest) break;
    count += 1;
  }
  return `${latest}${count}`;
}

function numberOrZero(value: string | null) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundPoints(parsed) : 0;
}

function roundPoints(value: number) {
  return Math.round(value * 100) / 100;
}
