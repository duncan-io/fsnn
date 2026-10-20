CREATE TABLE "opinion_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"league_key" text NOT NULL,
	"week" integer NOT NULL,
	"desk" text NOT NULL,
	"headline" text NOT NULL,
	"dek" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"angle_id" text NOT NULL,
	"brief" jsonb NOT NULL,
	"team_keys" jsonb NOT NULL,
	"columnist_name" text NOT NULL,
	"columnist_beat" text NOT NULL,
	"columnist_initials" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "opinion_columns_slug_unique" UNIQUE("slug"),
	CONSTRAINT "opinion_columns_league_week_desk_uidx" UNIQUE("league_key","week","desk")
);
--> statement-breakpoint
CREATE INDEX "opinion_columns_status_idx" ON "opinion_columns" USING btree ("status");