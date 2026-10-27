CREATE TABLE "breaking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_key" text NOT NULL,
	"week" integer NOT NULL,
	"kind" text NOT NULL,
	"source_key" text NOT NULL,
	"heat" integer NOT NULL,
	"status" text NOT NULL,
	"slug" text,
	"headline" text,
	"dek" text,
	"body" text,
	"brief" jsonb,
	"team_keys" jsonb NOT NULL,
	"reporter_name" text,
	"reporter_beat" text,
	"reporter_initials" text,
	"image_key" text,
	"event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "breaking_items_slug_unique" UNIQUE("slug"),
	CONSTRAINT "breaking_items_league_source_uidx" UNIQUE("league_key","source_key")
);
--> statement-breakpoint
CREATE INDEX "breaking_items_status_idx" ON "breaking_items" USING btree ("status");