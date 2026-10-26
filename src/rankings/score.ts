export type ScoreTeam = {
  teamKey: string;
  teamName: string;
  managerName: string | null;
  yahooRank: number | null;
};

export type ScoreGame = {
  week: number;
  teamKey: string;
  opponentTeamKey: string | null;
  points: number | null;
  projectedPoints: number | null;
  status: string | null;
};

export type ScoreStarter = {
  teamKey: string;
  seasonPoints: number | null;
  weekPoints?: number | null;
};

export type ScoreInput = {
  week: number;
  teams: ScoreTeam[];
  games: ScoreGame[];
  starters: ScoreStarter[];
  previousOrder: string[];
};

export type RankedTeam = {
  teamKey: string;
  teamName: string;
  managerName: string | null;
  rank: number;
  previousRank: number;
  wins: number;
  losses: number;
  ties: number;
  yahooRank: number | null;
  pointsFor: number;
  pointsAgainst: number;
  pointsPerGame: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  recentPointsPerGame: number | null;
  starterSeasonPoints: number | null;
  weekStarterPoints: number | null;
  projectionGap: number | null;
  pastOpponentPointsPerGame: number | null;
  remainingOpponentPointsPerGame: number | null;
  streak: string;
  streakCount: number;
  powerScore: number;
};

type StrengthWeights = {
  allPlay: number;
  ppg: number;
  recent: number;
  starters: number;
  projection: number;
};

type WeekLine = {
  opponentTeamKey: string;
  points: number;
  opponentPoints: number;
  projectedPoints: number | null;
  result: "W" | "L" | "T";
};

const RECENT_WEEKS = 3;
const PAST_SCHEDULE_CAP = 0.075;
const REMAINING_SCHEDULE_CAP = 0.05;

export function strengthWeights(completedWeeks: number): StrengthWeights {
  const allPlay = 0.35;
  const ppg = 0.25;
  const recent = 0.15;
  const starters = 0.15;
  const projection = 0.1;
  if (completedWeeks >= RECENT_WEEKS) return { allPlay, ppg, recent, starters, projection };
  const scale = 1 / (1 - recent);
  return {
    allPlay: allPlay * scale,
    ppg: ppg * scale,
    recent: 0,
    starters: starters * scale,
    projection: projection * scale,
  };
}

export function scoreLeague(input: ScoreInput): RankedTeam[] {
  const teams = uniqueTeams(input.teams);
  if (teams.length === 0) return [];
  const known = new Set(teams.map((team) => team.teamKey));
  const weeks = pairedWeeks(input.games, known, input.week);
  const weekNumbers = [...weeks.keys()].sort((a, b) => a - b);
  const weights = strengthWeights(weekNumbers.length);
  const recentWeekNumbers = weekNumbers.slice(-RECENT_WEEKS);
  const useRecent = weights.recent > 0;

  const ppgValue = new Map<string, number | null>();
  const allPlayValue = new Map<string, number | null>();
  const recentValue = new Map<string, number | null>();
  const starterValue = new Map<string, number | null>();
  const projectionValue = new Map<string, number | null>();
  const ppgByTeam = new Map<string, number>();
  const pastOpponents = new Map<string, string[]>();
  const remainingOpponents = new Map<string, string[]>();

  const starterSums = new Map<string, number>();
  const weekStarterSums = new Map<string, number>();
  const weekStarterSeen = new Set<string>();
  for (const starter of input.starters) {
    if (!known.has(starter.teamKey)) continue;
    if (starter.seasonPoints != null && Number.isFinite(starter.seasonPoints)) {
      starterSums.set(starter.teamKey, (starterSums.get(starter.teamKey) ?? 0) + starter.seasonPoints);
    }
    if (starter.weekPoints != null && Number.isFinite(starter.weekPoints)) {
      weekStarterSums.set(starter.teamKey, (weekStarterSums.get(starter.teamKey) ?? 0) + starter.weekPoints);
      weekStarterSeen.add(starter.teamKey);
    }
  }

  for (const team of teams) {
    const lines = weekNumbers.flatMap((week) => {
      const line = weeks.get(week)?.get(team.teamKey);
      return line ? [line] : [];
    });
    const games = lines.length;
    const pointsFor = lines.reduce((sum, line) => sum + line.points, 0);
    const rate = games === 0 ? null : allPlayRate(team.teamKey, weeks);
    ppgValue.set(team.teamKey, games === 0 ? null : pointsFor / games);
    allPlayValue.set(team.teamKey, rate);
    if (games > 0) ppgByTeam.set(team.teamKey, pointsFor / games);
    starterValue.set(team.teamKey, starterSums.has(team.teamKey) ? starterSums.get(team.teamKey) ?? 0 : null);
    const projected = lines.filter((line) => line.projectedPoints != null);
    projectionValue.set(
      team.teamKey,
      projected.length === 0
        ? null
        : projected.reduce((sum, line) => sum + (line.points - (line.projectedPoints ?? 0)), 0) / projected.length,
    );
    if (useRecent) {
      const recentLines = recentWeekNumbers.flatMap((week) => {
        const line = weeks.get(week)?.get(team.teamKey);
        return line ? [line] : [];
      });
      recentValue.set(
        team.teamKey,
        recentLines.length === 0
          ? null
          : recentLines.reduce((sum, line) => sum + line.points, 0) / recentLines.length,
      );
    } else {
      recentValue.set(team.teamKey, null);
    }
    pastOpponents.set(
      team.teamKey,
      lines.map((line) => line.opponentTeamKey),
    );
    remainingOpponents.set(team.teamKey, remainingOpponentKeys(input.games, known, team.teamKey, input.week));
  }

  const leagueAverage = average([...ppgByTeam.values()]);
  const pastBump = scheduleBump(
    opponentAverage(pastOpponents, ppgByTeam),
    leagueAverage,
    PAST_SCHEDULE_CAP,
  );
  const remainingBump = scheduleBump(
    opponentAverage(remainingOpponents, ppgByTeam),
    leagueAverage,
    REMAINING_SCHEDULE_CAP,
  );
  const ppgPercent = percentiles(ppgValue);
  const allPlayPercent = percentiles(allPlayValue);
  const recentPercent = percentiles(recentValue);
  const starterPercent = percentiles(starterValue);
  const projectionPercent = percentiles(projectionValue);

  const scored = teams.map((team) => {
    const lines = weekNumbers.flatMap((week) => {
      const line = weeks.get(week)?.get(team.teamKey);
      return line ? [line] : [];
    });
    const totals = countResults(lines);
    const allPlay = countAllPlay(team.teamKey, weeks);
    const pointsFor = lines.reduce((sum, line) => sum + line.points, 0);
    const pointsAgainst = lines.reduce((sum, line) => sum + line.opponentPoints, 0);
    const games = lines.length;
    const comparisons = allPlay.wins + allPlay.losses + allPlay.ties;
    const rawPpg = games === 0 ? 0 : pointsFor / games;
    const rawAllPlay = comparisons === 0 ? 0 : (allPlay.wins + allPlay.ties * 0.5) / comparisons;
    const streak = streakOf(lines.map((line) => line.result));
    const strength =
      weights.allPlay * (allPlayPercent.get(team.teamKey) ?? 0.5) +
      weights.ppg * (ppgPercent.get(team.teamKey) ?? 0.5) +
      weights.recent * (recentPercent.get(team.teamKey) ?? 0.5) +
      weights.starters * (starterPercent.get(team.teamKey) ?? 0.5) +
      weights.projection * (projectionPercent.get(team.teamKey) ?? 0.5);
    return {
      team,
      totals,
      allPlay,
      pointsFor,
      pointsAgainst,
      rawPpg,
      rawAllPlay,
      streak,
      recent: recentValue.get(team.teamKey) ?? null,
      starters: starterValue.get(team.teamKey) ?? null,
      weekStarters: weekStarterSeen.has(team.teamKey) ? weekStarterSums.get(team.teamKey) ?? 0 : null,
      projection: projectionValue.get(team.teamKey) ?? null,
      past: averageOpponent(pastOpponents.get(team.teamKey) ?? [], ppgByTeam),
      remaining: averageOpponent(remainingOpponents.get(team.teamKey) ?? [], ppgByTeam),
      powerScore: strength + (pastBump.get(team.teamKey) ?? 0) + (remainingBump.get(team.teamKey) ?? 0),
    };
  });

  scored.sort((a, b) => {
    if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
    if (b.rawPpg !== a.rawPpg) return b.rawPpg - a.rawPpg;
    if (b.rawAllPlay !== a.rawAllPlay) return b.rawAllPlay - a.rawAllPlay;
    return a.team.teamName.localeCompare(b.team.teamName);
  });

  const previous = new Map(input.previousOrder.map((teamKey, index) => [teamKey, index + 1]));
  return scored.map((row, index) => {
    const rank = index + 1;
    return {
      teamKey: row.team.teamKey,
      teamName: row.team.teamName,
      managerName: row.team.managerName,
      rank,
      previousRank: previous.get(row.team.teamKey) ?? rank,
      wins: row.totals.wins,
      losses: row.totals.losses,
      ties: row.totals.ties,
      yahooRank: row.team.yahooRank,
      pointsFor: roundPoints(row.pointsFor),
      pointsAgainst: roundPoints(row.pointsAgainst),
      pointsPerGame: roundPoints(row.rawPpg),
      allPlayWins: row.allPlay.wins,
      allPlayLosses: row.allPlay.losses,
      allPlayTies: row.allPlay.ties,
      recentPointsPerGame: row.recent == null ? null : roundPoints(row.recent),
      starterSeasonPoints: row.starters == null ? null : roundPoints(row.starters),
      weekStarterPoints: row.weekStarters == null ? null : roundPoints(row.weekStarters),
      projectionGap: row.projection == null ? null : roundPoints(row.projection),
      pastOpponentPointsPerGame: row.past == null ? null : roundPoints(row.past),
      remainingOpponentPointsPerGame: row.remaining == null ? null : roundPoints(row.remaining),
      streak: row.streak.label,
      streakCount: row.streak.count,
      powerScore: row.powerScore,
    };
  });
}

function uniqueTeams(teams: ScoreTeam[]): ScoreTeam[] {
  const seen = new Set<string>();
  const unique: ScoreTeam[] = [];
  for (const team of teams) {
    if (seen.has(team.teamKey)) continue;
    seen.add(team.teamKey);
    unique.push(team);
  }
  return unique;
}

function pairedWeeks(games: ScoreGame[], known: Set<string>, throughWeek: number) {
  const byWeek = new Map<number, Map<string, ScoreGame>>();
  for (const game of games) {
    if (game.week > throughWeek || game.status !== "postevent" || game.points == null) continue;
    if (!known.has(game.teamKey) || !game.opponentTeamKey || !known.has(game.opponentTeamKey)) continue;
    const week = byWeek.get(game.week) ?? new Map<string, ScoreGame>();
    week.set(game.teamKey, game);
    byWeek.set(game.week, week);
  }
  const paired = new Map<number, Map<string, WeekLine>>();
  for (const [week, rows] of byWeek) {
    const lines = new Map<string, WeekLine>();
    for (const row of rows.values()) {
      const opponentKey = row.opponentTeamKey;
      if (!opponentKey) continue;
      const opponent = rows.get(opponentKey);
      if (!opponent || opponent.opponentTeamKey !== row.teamKey || opponent.points == null || row.points == null) {
        continue;
      }
      const points = row.points;
      const opponentPoints = opponent.points;
      lines.set(row.teamKey, {
        opponentTeamKey: opponentKey,
        points,
        opponentPoints,
        projectedPoints: row.projectedPoints,
        result: points > opponentPoints ? "W" : points < opponentPoints ? "L" : "T",
      });
    }
    if (lines.size > 0) paired.set(week, lines);
  }
  return paired;
}

function remainingOpponentKeys(
  games: ScoreGame[],
  known: Set<string>,
  teamKey: string,
  throughWeek: number,
): string[] {
  const opponents: string[] = [];
  const seen = new Set<number>();
  for (const game of games) {
    if (game.teamKey !== teamKey || game.week <= throughWeek || seen.has(game.week)) continue;
    if (!game.opponentTeamKey || !known.has(game.opponentTeamKey)) continue;
    seen.add(game.week);
    opponents.push(game.opponentTeamKey);
  }
  return opponents;
}

function allPlayRate(teamKey: string, weeks: Map<number, Map<string, WeekLine>>): number {
  const totals = countAllPlay(teamKey, weeks);
  const games = totals.wins + totals.losses + totals.ties;
  if (games === 0) return 0;
  return (totals.wins + totals.ties * 0.5) / games;
}

function countAllPlay(teamKey: string, weeks: Map<number, Map<string, WeekLine>>) {
  const totals = { wins: 0, losses: 0, ties: 0 };
  for (const rows of weeks.values()) {
    const mine = rows.get(teamKey);
    if (!mine) continue;
    for (const [otherKey, other] of rows) {
      if (otherKey === teamKey) continue;
      if (mine.points > other.points) totals.wins += 1;
      else if (mine.points < other.points) totals.losses += 1;
      else totals.ties += 1;
    }
  }
  return totals;
}

function countResults(lines: WeekLine[]) {
  return {
    wins: lines.filter((line) => line.result === "W").length,
    losses: lines.filter((line) => line.result === "L").length,
    ties: lines.filter((line) => line.result === "T").length,
  };
}

function percentiles(values: Map<string, number | null>): Map<string, number> {
  const present = [...values.entries()].filter((entry): entry is [string, number] => entry[1] != null);
  const out = new Map<string, number>();
  if (present.length < 2) {
    for (const key of values.keys()) out.set(key, 0.5);
    return out;
  }
  const sorted = [...present].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1][1] === sorted[index][1]) end += 1;
    const pct = (index + end) / 2 / (sorted.length - 1);
    for (let cursor = index; cursor <= end; cursor += 1) out.set(sorted[cursor][0], pct);
    index = end + 1;
  }
  for (const [key, value] of values) {
    if (value == null) out.set(key, 0.5);
  }
  return out;
}

function opponentAverage(opponents: Map<string, string[]>, ppgByTeam: Map<string, number>) {
  const averages = new Map<string, number | null>();
  for (const [teamKey, keys] of opponents) averages.set(teamKey, averageOpponent(keys, ppgByTeam));
  return averages;
}

function averageOpponent(keys: string[], ppgByTeam: Map<string, number>): number | null {
  const values = keys.flatMap((key) => {
    const ppg = ppgByTeam.get(key);
    return ppg == null ? [] : [ppg];
  });
  return values.length === 0 ? null : average(values);
}

function scheduleBump(
  opponentPpg: Map<string, number | null>,
  leagueAverage: number | null,
  cap: number,
): Map<string, number> {
  const bump = new Map<string, number>();
  if (leagueAverage == null) {
    for (const key of opponentPpg.keys()) bump.set(key, 0);
    return bump;
  }
  let maxAbs = 0;
  const deltas = new Map<string, number | null>();
  for (const [key, value] of opponentPpg) {
    const delta = value == null ? null : value - leagueAverage;
    deltas.set(key, delta);
    if (delta != null) maxAbs = Math.max(maxAbs, Math.abs(delta));
  }
  for (const [key, delta] of deltas) {
    bump.set(key, delta == null || maxAbs === 0 ? 0 : (delta / maxAbs) * cap);
  }
  return bump;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function streakOf(results: Array<"W" | "L" | "T">): { label: string; count: number } {
  const latest = results.at(-1);
  if (!latest) return { label: "", count: 0 };
  let count = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== latest) break;
    count += 1;
  }
  return { label: `${latest}${count}`, count };
}

function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}
