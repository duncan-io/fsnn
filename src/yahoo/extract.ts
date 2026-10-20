import {
  asArray,
  contentOf,
  int,
  isRecord,
  numString,
  str,
  walk,
} from "./parse";

const HEAVY_LEAGUE_KEYS = new Set([
  "standings",
  "teams",
  "scoreboard",
  "players",
  "settings",
  "draft_results",
  "transactions",
  "matchups",
  "roster",
]);

export type GameRecord = {
  gameKey: string;
  gameId: string | null;
  code: string | null;
  season: string | null;
  name: string | null;
  type: string | null;
  url: string | null;
  isGameOver: boolean | null;
  isOffseason: boolean | null;
  isRegistrationOver: boolean | null;
  raw: Record<string, unknown>;
};

export type GameWeekRecord = {
  week: number;
  startDate: string | null;
  endDate: string | null;
  raw: Record<string, unknown>;
};

export type StatCategoryRecord = {
  statId: number;
  name: string | null;
  displayName: string | null;
  positionType: string | null;
  sortOrder: number | null;
  raw: Record<string, unknown>;
};

export type LeagueRecord = {
  leagueKey: string;
  gameKey: string;
  leagueId: string | null;
  name: string | null;
  url: string | null;
  draftStatus: string | null;
  numTeams: number | null;
  scoringType: string | null;
  leagueType: string | null;
  currentWeek: number | null;
  startWeek: number | null;
  endWeek: number | null;
  settings: unknown | null;
  raw: Record<string, unknown>;
};

export type TeamRecord = {
  teamKey: string;
  leagueKey: string;
  teamId: string | null;
  name: string | null;
  url: string | null;
  waiverPriority: number | null;
  faabBalance: number | null;
  numberOfMoves: number | null;
  numberOfTrades: number | null;
  logoUrl: string | null;
  managers: unknown[] | null;
  raw: Record<string, unknown>;
  standings: StandingRecord | null;
};

export type StandingRecord = {
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  percentage: string | null;
  pointsFor: string | null;
  pointsAgainst: string | null;
  raw: Record<string, unknown>;
};

export type MatchupRecord = {
  leagueKey: string;
  week: number;
  teamKey: string;
  opponentTeamKey: string | null;
  points: string | null;
  projectedPoints: string | null;
  isWinner: boolean | null;
  status: string | null;
  raw: Record<string, unknown>;
};

export type PlayerRecord = {
  playerKey: string;
  gameKey: string | null;
  playerId: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  nflTeam: string | null;
  displayPosition: string | null;
  positions: string[] | null;
  status: string | null;
  injuryNote: string | null;
  selectedPosition: string | null;
  ownershipType: string | null;
  ownerTeamKey: string | null;
  percentOwned: string | null;
  seasonPoints: string | null;
  seasonStats: unknown | null;
  hasOwnership: boolean;
  hasSeasonStats: boolean;
  raw: Record<string, unknown>;
};

export type DraftPickRecord = {
  leagueKey: string;
  pick: number;
  round: number | null;
  teamKey: string | null;
  playerKey: string | null;
  raw: Record<string, unknown>;
};

export type TransactionRecord = {
  transactionKey: string;
  leagueKey: string;
  type: string | null;
  status: string | null;
  timestamp: Date | null;
  faabBid: number | null;
  players: unknown[];
  raw: Record<string, unknown>;
};

function collect(node: unknown, match: (record: Record<string, unknown>) => boolean) {
  const found: Record<string, unknown>[] = [];
  walk(contentOf(node), (record) => {
    if (match(record)) found.push(record);
  });
  return found;
}

function richer(current: Record<string, unknown> | undefined, next: Record<string, unknown>) {
  if (!current) return next;
  return Object.keys(next).length > Object.keys(current).length ? next : current;
}

function flag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return null;
}

function omit(record: Record<string, unknown>, keys: Set<string>) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

function leagueKeyFromTeamKey(teamKey: string) {
  return teamKey.replace(/\.t\.[^.]+$/, "");
}

function gameKeyFromLeagueKey(leagueKey: string) {
  return leagueKey.split(".l.")[0] ?? leagueKey;
}

function gameKeyFromPlayerKey(playerKey: string) {
  const [gameKey] = playerKey.split(".p.");
  return gameKey || null;
}

function namedList(value: unknown, wrapper: string): Record<string, unknown>[] {
  return asArray(value).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (isRecord(entry[wrapper])) return [entry[wrapper]];
    return [entry];
  });
}

function positionsOf(player: Record<string, unknown>): string[] | null {
  const positions = namedList(player.eligible_positions, "position")
    .map((position) => str(position.position) ?? str(position))
    .filter((position): position is string => Boolean(position));
  const display = str(player.display_position);
  const unique = [...new Set(display ? [display, ...positions] : positions)];
  return unique.length > 0 ? unique : null;
}

function selectedPositionOf(player: Record<string, unknown>) {
  const selected = player.selected_position;
  if (typeof selected === "string") return selected;
  if (isRecord(selected)) return str(selected.position);
  for (const entry of asArray(selected)) {
    if (isRecord(entry) && str(entry.position)) return str(entry.position);
  }
  return null;
}

function logoUrl(team: Record<string, unknown>) {
  const direct = team.team_logo;
  if (typeof direct === "string" && direct.startsWith("http")) return direct;
  const logos = [
    ...(isRecord(direct) ? [direct] : []),
    ...namedList(team.team_logos, "team_logo"),
  ];
  const large = logos.find((logo) => logo.size === "large");
  return str(large?.url) ?? str(logos[0]?.url);
}

function managersOf(team: Record<string, unknown>) {
  const managers = namedList(team.managers, "manager").filter(
    (manager) => "manager_id" in manager || "nickname" in manager || "guid" in manager,
  );
  return managers.length > 0 ? managers : null;
}

function playerName(player: Record<string, unknown>) {
  const name = player.name;
  if (typeof name === "string") return { full: name, first: null, last: null };
  if (!isRecord(name)) return { full: null, first: null, last: null };
  return {
    full: str(name.full),
    first: str(name.first),
    last: str(name.last),
  };
}

function standingsOf(team: Record<string, unknown>): StandingRecord | null {
  const source = isRecord(team.team_standings)
    ? team.team_standings
    : isRecord(team.standings) &&
        ("rank" in team.standings || "outcome_totals" in team.standings || "points_for" in team.standings)
      ? team.standings
      : null;
  if (!source) return null;
  const totals = isRecord(source.outcome_totals) ? source.outcome_totals : {};
  const points = isRecord(team.team_points) ? team.team_points : {};
  return {
    rank: int(source.rank),
    wins: int(totals.wins),
    losses: int(totals.losses),
    ties: int(totals.ties),
    percentage: numString(totals.percentage),
    pointsFor: numString(source.points_for) ?? numString(points.total),
    pointsAgainst: numString(source.points_against),
    raw: source,
  };
}

function seasonStatsOf(player: Record<string, unknown>) {
  const stats = player.player_stats;
  if (!isRecord(stats)) return { hasSeasonStats: false, seasonStats: null, seasonPoints: null };
  const coverage = str(stats.coverage_type);
  if (coverage && coverage !== "season") {
    return { hasSeasonStats: false, seasonStats: null, seasonPoints: null };
  }
  const rows = asArray(stats.stats).flatMap((stat) => {
    const source = isRecord(stat) && isRecord(stat.stat) ? stat.stat : stat;
    if (!isRecord(source) || int(source.stat_id) == null) return [];
    return [{ statId: int(source.stat_id), value: str(source.value) }];
  });
  const points = isRecord(player.player_points) ? numString(player.player_points.total) : null;
  return {
    hasSeasonStats: rows.length > 0 || points != null,
    seasonStats: rows.length > 0 ? rows : null,
    seasonPoints: points,
  };
}

export function extractGames(flat: unknown): GameRecord[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of collect(
    flat,
    (item) =>
      typeof item.game_key === "string" &&
      !("league_key" in item) &&
      !("team_key" in item) &&
      !("player_key" in item) &&
      ("code" in item || "season" in item || "game_id" in item),
  )) {
    const gameKey = str(record.game_key);
    if (!gameKey) continue;
    byKey.set(gameKey, richer(byKey.get(gameKey), record));
  }
  return [...byKey.entries()].map(([gameKey, record]) => ({
    gameKey,
    gameId: str(record.game_id),
    code: str(record.code),
    season: str(record.season),
    name: str(record.name),
    type: str(record.type),
    url: str(record.url),
    isGameOver: flag(record.is_game_over),
    isOffseason: flag(record.is_offseason),
    isRegistrationOver: flag(record.is_registration_over),
    raw: omit(record, new Set(["game_weeks", "stat_categories", "position_types", "roster_positions", "leagues", "teams", "players"])),
  }));
}

export function extractGameWeeks(flat: unknown): GameWeekRecord[] {
  const byWeek = new Map<number, GameWeekRecord>();
  for (const record of collect(
    flat,
    (item) => "week" in item && "start" in item && "end" in item && !("team_key" in item),
  )) {
    const week = int(record.week);
    if (week == null) continue;
    byWeek.set(week, {
      week,
      startDate: str(record.start),
      endDate: str(record.end),
      raw: record,
    });
  }
  return [...byWeek.values()];
}

export function extractStatCategories(flat: unknown): StatCategoryRecord[] {
  const byId = new Map<number, StatCategoryRecord>();
  for (const record of collect(
    flat,
    (item) =>
      int(item.stat_id) != null &&
      (typeof item.name === "string" || typeof item.display_name === "string") &&
      !("player_key" in item),
  )) {
    const statId = int(record.stat_id);
    if (statId == null) continue;
    byId.set(statId, {
      statId,
      name: str(record.name),
      displayName: str(record.display_name),
      positionType: str(record.position_type),
      sortOrder: int(record.sort_order),
      raw: record,
    });
  }
  return [...byId.values()];
}

export function extractSubtree(flat: unknown, key: string): unknown {
  let found: unknown;
  let seen = false;
  walk(contentOf(flat), (record) => {
    if (!seen && key in record) {
      found = record[key];
      seen = true;
    }
  });
  return found;
}

export function extractLeagues(flat: unknown): LeagueRecord[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of collect(
    flat,
    (item) =>
      typeof item.league_key === "string" &&
      !("team_key" in item) &&
      !("player_key" in item) &&
      ("league_id" in item || "num_teams" in item || "scoring_type" in item || "draft_status" in item),
  )) {
    const leagueKey = str(record.league_key);
    if (!leagueKey) continue;
    byKey.set(leagueKey, richer(byKey.get(leagueKey), record));
  }
  return [...byKey.entries()].map(([leagueKey, record]) => ({
    leagueKey,
    gameKey: gameKeyFromLeagueKey(leagueKey),
    leagueId: str(record.league_id),
    name: str(record.name),
    url: str(record.url),
    draftStatus: str(record.draft_status),
    numTeams: int(record.num_teams),
    scoringType: str(record.scoring_type),
    leagueType: str(record.league_type),
    currentWeek: int(record.current_week),
    startWeek: int(record.start_week),
    endWeek: int(record.end_week),
    settings: record.settings ?? null,
    raw: omit(record, HEAVY_LEAGUE_KEYS),
  }));
}

export function extractTeams(flat: unknown): TeamRecord[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of collect(
    flat,
    (item) =>
      typeof item.team_key === "string" &&
      !("player_key" in item) &&
      ("name" in item || "team_id" in item),
  )) {
    const teamKey = str(record.team_key);
    if (!teamKey) continue;
    byKey.set(teamKey, richer(byKey.get(teamKey), record));
  }
  return [...byKey.entries()].map(([teamKey, record]) => ({
    teamKey,
    leagueKey: leagueKeyFromTeamKey(teamKey),
    teamId: str(record.team_id),
    name: str(record.name),
    url: str(record.url),
    waiverPriority: int(record.waiver_priority),
    faabBalance: int(record.faab_balance),
    numberOfMoves: int(record.number_of_moves),
    numberOfTrades: int(record.number_of_trades),
    logoUrl: logoUrl(record),
    managers: managersOf(record),
    raw: omit(record, new Set(["roster", "players", "matchups"])),
    standings: standingsOf(record),
  }));
}

export function extractMatchups(flat: unknown): MatchupRecord[] {
  const rows = new Map<string, MatchupRecord>();
  for (const matchup of collect(
    flat,
    (item) => "week" in item && Array.isArray(item.teams) && !("team_key" in item),
  )) {
    const week = int(matchup.week);
    if (week == null) continue;
    const teams = asArray(matchup.teams).filter(isRecord);
    const winner = str(matchup.winner_team_key);
    const status = str(matchup.status);
    for (const team of teams) {
      const teamKey = str(team.team_key);
      if (!teamKey) continue;
      const opponent = teams.find((other) => str(other.team_key) && str(other.team_key) !== teamKey);
      const points = isRecord(team.team_points) ? numString(team.team_points.total) : null;
      const projected = isRecord(team.team_projected_points)
        ? numString(team.team_projected_points.total)
        : null;
      const opponentPoints =
        opponent && isRecord(opponent.team_points) ? numString(opponent.team_points.total) : null;
      let isWinner: boolean | null = null;
      if (winner) isWinner = winner === teamKey;
      else if (points != null && opponentPoints != null) isWinner = Number(points) > Number(opponentPoints);
      const row: MatchupRecord = {
        leagueKey: leagueKeyFromTeamKey(teamKey),
        week,
        teamKey,
        opponentTeamKey: opponent ? str(opponent.team_key) : null,
        points,
        projectedPoints: projected,
        isWinner,
        status,
        raw: team,
      };
      rows.set(`${row.leagueKey}:${week}:${teamKey}`, row);
    }
  }
  return [...rows.values()];
}

export function extractPlayers(flat: unknown): PlayerRecord[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of collect(flat, (item) => typeof item.player_key === "string")) {
    const playerKey = str(record.player_key);
    if (!playerKey) continue;
    byKey.set(playerKey, richer(byKey.get(playerKey), record));
  }
  return [...byKey.entries()].map(([playerKey, record]) => {
    const name = playerName(record);
    const ownership = isRecord(record.ownership) ? record.ownership : null;
    const percent = isRecord(record.percent_owned)
      ? numString(record.percent_owned.value)
      : numString(record.percent_owned);
    const season = seasonStatsOf(record);
    return {
      playerKey,
      gameKey: gameKeyFromPlayerKey(playerKey),
      playerId: str(record.player_id),
      name: name.full,
      firstName: name.first,
      lastName: name.last,
      nflTeam: str(record.editorial_team_abbr),
      displayPosition: str(record.display_position),
      positions: positionsOf(record),
      status: str(record.status),
      injuryNote: str(record.injury_note),
      selectedPosition: selectedPositionOf(record),
      ownershipType: ownership ? str(ownership.ownership_type) : null,
      ownerTeamKey: ownership ? str(ownership.owner_team_key) : null,
      percentOwned: percent,
      seasonPoints: season.seasonPoints,
      seasonStats: season.seasonStats,
      hasOwnership: ownership != null,
      hasSeasonStats: season.hasSeasonStats,
      raw: record,
    };
  });
}

export function extractDraftPicks(flat: unknown): DraftPickRecord[] {
  const byPick = new Map<string, DraftPickRecord>();
  for (const record of collect(
    flat,
    (item) => int(item.pick) != null && "player_key" in item && "team_key" in item && !("transaction_key" in item),
  )) {
    const teamKey = str(record.team_key);
    const pick = int(record.pick);
    if (!teamKey || pick == null) continue;
    const leagueKey = leagueKeyFromTeamKey(teamKey);
    byPick.set(`${leagueKey}:${pick}`, {
      leagueKey,
      pick,
      round: int(record.round),
      teamKey,
      playerKey: str(record.player_key),
      raw: record,
    });
  }
  return [...byPick.values()];
}

export function extractTransactions(flat: unknown): TransactionRecord[] {
  const byKey = new Map<string, TransactionRecord>();
  for (const record of collect(flat, (item) => typeof item.transaction_key === "string")) {
    const transactionKey = str(record.transaction_key);
    if (!transactionKey) continue;
    const leagueKey = transactionKey.replace(/\.tr\..+$/, "").replace(/\.w\..+$/, "").replace(/\.pt\..+$/, "");
    const players = asArray(record.players).flatMap((player) => {
      if (!isRecord(player)) return [];
      const data = isRecord(player.transaction_data) ? player.transaction_data : {};
      const name = playerName(player);
      return [
        {
          playerKey: str(player.player_key),
          name: name.full,
          type: str(data.type),
          sourceType: str(data.source_type),
          sourceTeamKey: str(data.source_team_key),
          destinationType: str(data.destination_type),
          destinationTeamKey: str(data.destination_team_key),
        },
      ];
    });
    const seconds = int(record.timestamp);
    byKey.set(transactionKey, {
      transactionKey,
      leagueKey,
      type: str(record.type),
      status: str(record.status),
      timestamp: seconds == null ? null : new Date(seconds * 1000),
      faabBid: int(record.faab_bid),
      players,
      raw: record,
    });
  }
  return [...byKey.values()];
}
