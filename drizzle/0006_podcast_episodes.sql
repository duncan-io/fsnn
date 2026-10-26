CREATE TABLE "podcast_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_key" text NOT NULL,
	"week" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"script" jsonb NOT NULL,
	"brief" jsonb NOT NULL,
	"audio_key" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"audio_bytes" integer NOT NULL,
	"hosts" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_episodes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "podcast_episodes_league_week_uidx" UNIQUE("league_key","week")
);
