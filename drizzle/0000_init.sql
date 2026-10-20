CREATE TABLE "draft_picks" (
	"league_key" text NOT NULL,
	"pick" integer NOT NULL,
	"round" integer,
	"team_key" text,
	"player_key" text,
	"raw" jsonb NOT NULL,
	CONSTRAINT "draft_picks_league_key_pick_pk" PRIMARY KEY("league_key","pick")
);
--> statement-breakpoint
CREATE TABLE "game_weeks" (
	"game_key" text NOT NULL,
	"week" integer NOT NULL,
	"start_date" text,
	"end_date" text,
	"raw" jsonb NOT NULL,
	CONSTRAINT "game_weeks_game_key_week_pk" PRIMARY KEY("game_key","week")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"game_key" text PRIMARY KEY NOT NULL,
	"game_id" text,
	"code" text,
	"season" text,
	"name" text,
	"type" text,
	"url" text,
	"is_game_over" boolean,
	"is_offseason" boolean,
	"is_registration_over" boolean,
	"position_types" jsonb,
	"roster_positions" jsonb,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"league_key" text PRIMARY KEY NOT NULL,
	"game_key" text NOT NULL,
	"league_id" text,
	"name" text,
	"url" text,
	"draft_status" text,
	"num_teams" integer,
	"scoring_type" text,
	"league_type" text,
	"current_week" integer,
	"start_week" integer,
	"end_week" integer,
	"settings" jsonb,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchups" (
	"league_key" text NOT NULL,
	"week" integer NOT NULL,
	"team_key" text NOT NULL,
	"opponent_team_key" text,
	"points" numeric,
	"projected_points" numeric,
	"is_winner" boolean,
	"status" text,
	"raw" jsonb NOT NULL,
	CONSTRAINT "matchups_league_key_week_team_key_pk" PRIMARY KEY("league_key","week","team_key")
);
--> statement-breakpoint
CREATE TABLE "player_ownership" (
	"league_key" text NOT NULL,
	"player_key" text NOT NULL,
	"ownership_type" text,
	"team_key" text,
	"percent_owned" numeric,
	"season_points" numeric,
	"season_stats" jsonb,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_ownership_league_key_player_key_pk" PRIMARY KEY("league_key","player_key")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"player_key" text PRIMARY KEY NOT NULL,
	"game_key" text,
	"player_id" text,
	"name" text,
	"first_name" text,
	"last_name" text,
	"nfl_team" text,
	"display_position" text,
	"positions" jsonb,
	"status" text,
	"injury_note" text,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_entries" (
	"league_key" text NOT NULL,
	"team_key" text NOT NULL,
	"week" integer NOT NULL,
	"player_key" text NOT NULL,
	"selected_position" text,
	"raw" jsonb NOT NULL,
	CONSTRAINT "roster_entries_league_key_team_key_week_player_key_pk" PRIMARY KEY("league_key","team_key","week","player_key")
);
--> statement-breakpoint
CREATE TABLE "stat_categories" (
	"game_key" text NOT NULL,
	"stat_id" integer NOT NULL,
	"name" text,
	"display_name" text,
	"position_type" text,
	"sort_order" integer,
	"raw" jsonb NOT NULL,
	CONSTRAINT "stat_categories_game_key_stat_id_pk" PRIMARY KEY("game_key","stat_id")
);
--> statement-breakpoint
CREATE TABLE "team_standings" (
	"team_key" text PRIMARY KEY NOT NULL,
	"league_key" text NOT NULL,
	"rank" integer,
	"wins" integer,
	"losses" integer,
	"ties" integer,
	"percentage" numeric,
	"points_for" numeric,
	"points_against" numeric,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team_key" text PRIMARY KEY NOT NULL,
	"league_key" text NOT NULL,
	"team_id" text,
	"name" text,
	"url" text,
	"waiver_priority" integer,
	"faab_balance" integer,
	"number_of_moves" integer,
	"number_of_trades" integer,
	"logo_url" text,
	"managers" jsonb,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"transaction_key" text PRIMARY KEY NOT NULL,
	"league_key" text NOT NULL,
	"type" text,
	"status" text,
	"timestamp" timestamp with time zone,
	"faab_bid" integer,
	"players" jsonb,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yahoo_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yahoo_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token_type" text DEFAULT 'bearer' NOT NULL,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "matchups_league_week_idx" ON "matchups" USING btree ("league_key","week");--> statement-breakpoint
CREATE INDEX "teams_league_key_idx" ON "teams" USING btree ("league_key");--> statement-breakpoint
CREATE INDEX "transactions_league_key_idx" ON "transactions" USING btree ("league_key");--> statement-breakpoint
CREATE INDEX "yahoo_resources_path_fetched_idx" ON "yahoo_resources" USING btree ("path","fetched_at");