import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const yahooTokens = pgTable("yahoo_tokens", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  tokenType: text("token_type").notNull().default("bearer"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable("games", {
  gameKey: text("game_key").primaryKey(),
  gameId: text("game_id"),
  code: text("code"),
  season: text("season"),
  name: text("name"),
  type: text("type"),
  url: text("url"),
  isGameOver: boolean("is_game_over"),
  isOffseason: boolean("is_offseason"),
  isRegistrationOver: boolean("is_registration_over"),
  positionTypes: jsonb("position_types"),
  rosterPositions: jsonb("roster_positions"),
  raw: jsonb("raw").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameWeeks = pgTable(
  "game_weeks",
  {
    gameKey: text("game_key").notNull(),
    week: integer("week").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameKey, table.week] })],
);

export const statCategories = pgTable(
  "stat_categories",
  {
    gameKey: text("game_key").notNull(),
    statId: integer("stat_id").notNull(),
    name: text("name"),
    displayName: text("display_name"),
    positionType: text("position_type"),
    sortOrder: integer("sort_order"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameKey, table.statId] })],
);

export const leagues = pgTable("leagues", {
  leagueKey: text("league_key").primaryKey(),
  gameKey: text("game_key").notNull(),
  leagueId: text("league_id"),
  name: text("name"),
  url: text("url"),
  draftStatus: text("draft_status"),
  numTeams: integer("num_teams"),
  scoringType: text("scoring_type"),
  leagueType: text("league_type"),
  currentWeek: integer("current_week"),
  startWeek: integer("start_week"),
  endWeek: integer("end_week"),
  settings: jsonb("settings"),
  raw: jsonb("raw").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    teamKey: text("team_key").primaryKey(),
    leagueKey: text("league_key").notNull(),
    teamId: text("team_id"),
    name: text("name"),
    url: text("url"),
    waiverPriority: integer("waiver_priority"),
    faabBalance: integer("faab_balance"),
    numberOfMoves: integer("number_of_moves"),
    numberOfTrades: integer("number_of_trades"),
    logoUrl: text("logo_url"),
    managers: jsonb("managers"),
    raw: jsonb("raw").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("teams_league_key_idx").on(table.leagueKey)],
);

export const teamStandings = pgTable("team_standings", {
  teamKey: text("team_key").primaryKey(),
  leagueKey: text("league_key").notNull(),
  rank: integer("rank"),
  wins: integer("wins"),
  losses: integer("losses"),
  ties: integer("ties"),
  percentage: numeric("percentage"),
  pointsFor: numeric("points_for"),
  pointsAgainst: numeric("points_against"),
  raw: jsonb("raw").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchups = pgTable(
  "matchups",
  {
    leagueKey: text("league_key").notNull(),
    week: integer("week").notNull(),
    teamKey: text("team_key").notNull(),
    opponentTeamKey: text("opponent_team_key"),
    points: numeric("points"),
    projectedPoints: numeric("projected_points"),
    isWinner: boolean("is_winner"),
    status: text("status"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.leagueKey, table.week, table.teamKey] }),
    index("matchups_league_week_idx").on(table.leagueKey, table.week),
  ],
);

export const rosterEntries = pgTable(
  "roster_entries",
  {
    leagueKey: text("league_key").notNull(),
    teamKey: text("team_key").notNull(),
    week: integer("week").notNull(),
    playerKey: text("player_key").notNull(),
    selectedPosition: text("selected_position"),
    weekStats: jsonb("week_stats"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.leagueKey, table.teamKey, table.week, table.playerKey],
    }),
  ],
);

export const players = pgTable("players", {
  playerKey: text("player_key").primaryKey(),
  gameKey: text("game_key"),
  playerId: text("player_id"),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  nflTeam: text("nfl_team"),
  displayPosition: text("display_position"),
  positions: jsonb("positions"),
  status: text("status"),
  injuryNote: text("injury_note"),
  raw: jsonb("raw").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerOwnership = pgTable(
  "player_ownership",
  {
    leagueKey: text("league_key").notNull(),
    playerKey: text("player_key").notNull(),
    ownershipType: text("ownership_type"),
    teamKey: text("team_key"),
    percentOwned: numeric("percent_owned"),
    seasonPoints: numeric("season_points"),
    seasonStats: jsonb("season_stats"),
    raw: jsonb("raw").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.leagueKey, table.playerKey] })],
);

export const draftPicks = pgTable(
  "draft_picks",
  {
    leagueKey: text("league_key").notNull(),
    pick: integer("pick").notNull(),
    round: integer("round"),
    teamKey: text("team_key"),
    playerKey: text("player_key"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [primaryKey({ columns: [table.leagueKey, table.pick] })],
);

export const transactions = pgTable(
  "transactions",
  {
    transactionKey: text("transaction_key").primaryKey(),
    leagueKey: text("league_key").notNull(),
    type: text("type"),
    status: text("status"),
    timestamp: timestamp("timestamp", { withTimezone: true }),
    faabBid: integer("faab_bid"),
    players: jsonb("players"),
    raw: jsonb("raw").notNull(),
  },
  (table) => [index("transactions_league_key_idx").on(table.leagueKey)],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueKey: text("league_key").notNull(),
    week: integer("week").notNull(),
    scope: text("scope").notNull(),
    matchupKey: text("matchup_key"),
    slug: text("slug").notNull(),
    headline: text("headline").notNull(),
    dek: text("dek").notNull(),
    body: jsonb("body"),
    teamKeys: jsonb("team_keys").notNull(),
    reporterName: text("reporter_name").notNull(),
    reporterBeat: text("reporter_beat").notNull(),
    reporterInitials: text("reporter_initials").notNull(),
    imageKey: text("image_key"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    factSheet: jsonb("fact_sheet").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("articles_slug_unique").on(table.slug),
    unique("articles_slot_unique")
      .on(table.leagueKey, table.week, table.scope, table.matchupKey)
      .nullsNotDistinct(),
    index("articles_week_idx").on(table.week),
  ],
);

export const opinionColumns = pgTable(
  "opinion_columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    leagueKey: text("league_key").notNull(),
    week: integer("week").notNull(),
    desk: text("desk").notNull(),
    headline: text("headline").notNull(),
    dek: text("dek").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(),
    angleId: text("angle_id").notNull(),
    brief: jsonb("brief")
      .$type<{
        claim: string;
        evidence: string[];
        counterEvidence: string[];
        heat: number;
      }>()
      .notNull(),
    teamKeys: jsonb("team_keys").$type<string[]>().notNull(),
    columnistName: text("columnist_name").notNull(),
    columnistBeat: text("columnist_beat").notNull(),
    columnistInitials: text("columnist_initials").notNull(),
    imageKey: text("image_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    unique("opinion_columns_slug_unique").on(table.slug),
    unique("opinion_columns_league_week_desk_uidx").on(table.leagueKey, table.week, table.desk),
    index("opinion_columns_status_idx").on(table.status),
  ],
);

export const readers = pgTable(
  "readers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    displayKey: text("display_key").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("readers_email_unique").on(table.email),
    unique("readers_display_key_unique").on(table.displayKey),
  ],
);

export const readerSessions = pgTable("reader_sessions", {
  token: text("token").primaryKey(),
  readerId: uuid("reader_id")
    .notNull()
    .references(() => readers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const articleLikes = pgTable(
  "article_likes",
  {
    readerId: uuid("reader_id")
      .notNull()
      .references(() => readers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.readerId, table.slug] }),
    index("article_likes_slug_idx").on(table.slug),
  ],
);

export const articleComments = pgTable(
  "article_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => readers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("article_comments_slug_idx").on(table.slug, table.createdAt)],
);

export const podcastEpisodes = pgTable(
  "podcast_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueKey: text("league_key").notNull(),
    week: integer("week").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    script: jsonb("script").notNull(),
    brief: jsonb("brief").notNull(),
    audioKey: text("audio_key").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    audioBytes: integer("audio_bytes").notNull(),
    hosts: jsonb("hosts").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("podcast_episodes_slug_unique").on(table.slug),
    unique("podcast_episodes_league_week_uidx").on(table.leagueKey, table.week),
  ],
);

export const yahooResources = pgTable(
  "yahoo_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    path: text("path").notNull(),
    status: integer("status").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    body: jsonb("body").notNull(),
  },
  (table) => [index("yahoo_resources_path_fetched_idx").on(table.path, table.fetchedAt)],
);
