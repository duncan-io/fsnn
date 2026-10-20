CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_key" text NOT NULL,
	"week" integer NOT NULL,
	"scope" text NOT NULL,
	"matchup_key" text,
	"slug" text NOT NULL,
	"headline" text NOT NULL,
	"dek" text NOT NULL,
	"body" jsonb,
	"team_keys" jsonb NOT NULL,
	"reporter_name" text NOT NULL,
	"reporter_beat" text NOT NULL,
	"reporter_initials" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fact_sheet" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_slot_unique" UNIQUE NULLS NOT DISTINCT("league_key","week","scope","matchup_key")
);
--> statement-breakpoint
CREATE INDEX "articles_week_idx" ON "articles" USING btree ("week");