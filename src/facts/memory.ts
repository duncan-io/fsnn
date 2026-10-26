import type { BiggestWin, HeadToHead, PlayoffLine, WeekResult } from "./types";

export type MemoryGame = {
  week: number;
  teamKey: string;
  opponentTeamKey: string | null;
  points: number | null;
  status: string | null;
};

export type MemoryTeam = {
  teamKey: string;
  teamName: string;
};

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

export type WeekRecord = {
  teamKey: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
};

type Played = {
  week: number;
  opponentKey: string;
  points: number;
  opponentPoints: number;
  result: "W" | "L" | "T";
};

export type TeamMemory = {
  rankByWeek: Array<{ week: number; rank: number }>;
  longestStreak: string;
  biggestWin: BiggestWin | null;
  headToHead: HeadToHead[];
  remainingOpponents: Array<{ name: string; pointsPerGame: number | null }>;
  playoff: PlayoffLine | null;
  weekResult: WeekResult | null;
};

export function seasonMemory(
  teams: MemoryTeam[],
  games: MemoryGame[],
  week: number,
  playoffTeams: number | null,
  endWeek: number | null,
): Map<string, TeamMemory> {
  const names = new Map(teams.map((team) => [team.teamKey, team.teamName]));
  const known = new Set(teams.map((team) => team.teamKey));
  const played = playedGames(games, known);
  const weeks = [...played.keys()].filter((value) => value <= week).sort((a, b) => a - b);
  const rankByWeek = new Map<string, Array<{ week: number; rank: number }>>();
  for (const team of teams) rankByWeek.set(team.teamKey, []);
  const through = new Map<string, Standing>();
  for (const team of teams) {
    through.set(team.teamKey, {
      teamKey: team.teamKey,
      teamName: team.teamName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      results: [],
    });
  }
  for (const value of weeks) {
    applyWeek(through, played.get(value) ?? new Map());
    const table = ranks(through);
    for (const team of teams) {
      rankByWeek.get(team.teamKey)?.push({ week: value, rank: table.get(team.teamKey) ?? teams.length });
    }
  }

  const ppg = pointsPerGame(played, week);
  const memories = new Map<string, TeamMemory>();
  for (const team of teams) {
    const lines = weeks.flatMap((value) => {
      const line = played.get(value)?.get(team.teamKey);
      return line ? [line] : [];
    });
    const current = played.get(week)?.get(team.teamKey) ?? null;
    memories.set(team.teamKey, {
      rankByWeek: rankByWeek.get(team.teamKey) ?? [],
      longestStreak: longest(lines.map((line) => line.result)),
      biggestWin: biggest(lines, names),
      headToHead: series(lines, names),
      remainingOpponents: remaining(games, known, team.teamKey, week, names, ppg),
      playoff: playoffLine(through, team.teamKey, playoffTeams, endWeek, week),
      weekResult: current
        ? {
            result: current.result === "W" ? "win" : current.result === "L" ? "loss" : "tie",
            opponentName: names.get(current.opponentKey) ?? current.opponentKey,
            points: round(current.points),
            opponentPoints: round(current.opponentPoints),
          }
        : null,
    });
  }
  return memories;
}

export function recordsThrough(teams: MemoryTeam[], games: MemoryGame[], week: number): WeekRecord[] {
  const known = new Set(teams.map((team) => team.teamKey));
  const played = playedGames(games, known);
  const weeks = [...played.keys()].filter((value) => value <= week).sort((a, b) => a - b);
  const through = new Map<string, Standing>();
  for (const team of teams) {
    through.set(team.teamKey, {
      teamKey: team.teamKey,
      teamName: team.teamName,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      results: [],
    });
  }
  for (const value of weeks) applyWeek(through, played.get(value) ?? new Map());
  const rank = ranks(through);
  return teams.map((team) => {
    const row = through.get(team.teamKey);
    return {
      teamKey: team.teamKey,
      wins: row?.wins ?? 0,
      losses: row?.losses ?? 0,
      ties: row?.ties ?? 0,
      pointsFor: row?.pointsFor ?? 0,
      pointsAgainst: row?.pointsAgainst ?? 0,
      rank: rank.get(team.teamKey) ?? teams.length,
    };
  });
}

function playedGames(games: MemoryGame[], known: Set<string>) {
  const byWeek = new Map<number, Map<string, MemoryGame>>();
  for (const game of games) {
    if (game.status !== "postevent" || game.points == null) continue;
    if (!known.has(game.teamKey) || !game.opponentTeamKey || !known.has(game.opponentTeamKey)) continue;
    const week = byWeek.get(game.week) ?? new Map<string, MemoryGame>();
    week.set(game.teamKey, game);
    byWeek.set(game.week, week);
  }
  const paired = new Map<number, Map<string, Played>>();
  for (const [week, rows] of byWeek) {
    const lines = new Map<string, Played>();
    for (const row of rows.values()) {
      const opponentKey = row.opponentTeamKey;
      if (!opponentKey || row.points == null) continue;
      const opponent = rows.get(opponentKey);
      if (!opponent || opponent.opponentTeamKey !== row.teamKey || opponent.points == null) continue;
      const points = row.points;
      const opponentPoints = opponent.points;
      lines.set(row.teamKey, {
        week,
        opponentKey,
        points,
        opponentPoints,
        result: points > opponentPoints ? "W" : points < opponentPoints ? "L" : "T",
      });
    }
    if (lines.size > 0) paired.set(week, lines);
  }
  return paired;
}

function applyWeek(table: Map<string, Standing>, lines: Map<string, Played>) {
  const seen = new Set<string>();
  for (const [teamKey, line] of lines) {
    const key = [teamKey, line.opponentKey].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    const team = table.get(teamKey);
    const opponent = table.get(line.opponentKey);
    if (!team || !opponent) continue;
    team.pointsFor = round(team.pointsFor + line.points);
    opponent.pointsFor = round(opponent.pointsFor + line.opponentPoints);
    team.pointsAgainst = round(team.pointsAgainst + line.opponentPoints);
    opponent.pointsAgainst = round(opponent.pointsAgainst + line.points);
    team.results.push(line.result);
    const opposite = line.result === "W" ? "L" : line.result === "L" ? "W" : "T";
    opponent.results.push(opposite);
    if (line.result === "T") {
      team.ties += 1;
      opponent.ties += 1;
    } else if (line.result === "W") {
      team.wins += 1;
      opponent.losses += 1;
    } else {
      team.losses += 1;
      opponent.wins += 1;
    }
  }
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
    if (previous && previous.wins === standing.wins && previous.pointsFor === standing.pointsFor) {
      rank.set(standing.teamKey, rank.get(previous.teamKey) ?? index + 1);
      return;
    }
    rank.set(standing.teamKey, index + 1);
  });
  return rank;
}

function longest(results: Array<"W" | "L" | "T">): string {
  let best = "";
  let bestCount = 0;
  let bestEnd = -1;
  let index = 0;
  while (index < results.length) {
    let end = index;
    while (end + 1 < results.length && results[end + 1] === results[index]) end += 1;
    const count = end - index + 1;
    if (count > bestCount || (count === bestCount && end > bestEnd)) {
      bestCount = count;
      bestEnd = end;
      best = `${results[index]}${count}`;
    }
    index = end + 1;
  }
  return best;
}

function biggest(lines: Played[], names: Map<string, string>): BiggestWin | null {
  let best: BiggestWin | null = null;
  for (const line of lines) {
    if (line.result !== "W") continue;
    const margin = round(line.points - line.opponentPoints);
    const opponentName = names.get(line.opponentKey) ?? line.opponentKey;
    if (
      !best ||
      margin > best.margin ||
      (margin === best.margin && (line.week < best.week || (line.week === best.week && opponentName < best.opponentName)))
    ) {
      best = { opponentName, margin, week: line.week };
    }
  }
  return best;
}

function series(lines: Played[], names: Map<string, string>): HeadToHead[] {
  const totals = new Map<string, HeadToHead>();
  for (const line of lines) {
    const current = totals.get(line.opponentKey) ?? {
      opponentName: names.get(line.opponentKey) ?? line.opponentKey,
      wins: 0,
      losses: 0,
      ties: 0,
    };
    if (line.result === "W") current.wins += 1;
    else if (line.result === "L") current.losses += 1;
    else current.ties += 1;
    totals.set(line.opponentKey, current);
  }
  return [...totals.values()].sort((a, b) => a.opponentName.localeCompare(b.opponentName));
}

function remaining(
  games: MemoryGame[],
  known: Set<string>,
  teamKey: string,
  throughWeek: number,
  names: Map<string, string>,
  ppg: Map<string, number | null>,
) {
  const opponents: Array<{ name: string; pointsPerGame: number | null }> = [];
  const seen = new Set<number>();
  const ordered = [...games].sort((a, b) => a.week - b.week || a.teamKey.localeCompare(b.teamKey));
  for (const game of ordered) {
    if (game.teamKey !== teamKey || game.week <= throughWeek || seen.has(game.week)) continue;
    if (!game.opponentTeamKey || !known.has(game.opponentTeamKey)) continue;
    seen.add(game.week);
    opponents.push({
      name: names.get(game.opponentTeamKey) ?? game.opponentTeamKey,
      pointsPerGame: ppg.get(game.opponentTeamKey) ?? null,
    });
  }
  return opponents;
}

function pointsPerGame(played: Map<number, Map<string, Played>>, throughWeek: number) {
  const sums = new Map<string, { points: number; games: number }>();
  for (const [week, rows] of played) {
    if (week > throughWeek) continue;
    for (const [teamKey, line] of rows) {
      const current = sums.get(teamKey) ?? { points: 0, games: 0 };
      current.points += line.points;
      current.games += 1;
      sums.set(teamKey, current);
    }
  }
  const rates = new Map<string, number | null>();
  for (const [teamKey, total] of sums) {
    rates.set(teamKey, total.games === 0 ? null : round(total.points / total.games));
  }
  return rates;
}

function playoffLine(
  table: Map<string, Standing>,
  teamKey: string,
  playoffTeams: number | null,
  endWeek: number | null,
  week: number,
): PlayoffLine | null {
  if (playoffTeams == null || playoffTeams <= 0) return null;
  const rank = ranks(table);
  const team = table.get(teamKey);
  const place = rank.get(teamKey);
  if (!team || place == null) return null;
  const cutoff = [...table.values()].find((row) => rank.get(row.teamKey) === Math.min(playoffTeams, table.size));
  const gamesBack = cutoff ? Math.max(0, cutoff.wins - team.wins) : 0;
  return {
    gamesBack,
    teamsAhead: Math.max(0, place - 1),
    weeksLeft: endWeek == null ? null : Math.max(0, endWeek - week),
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
