ALTER TABLE "articles" ALTER COLUMN "published_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "published_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_notes" jsonb;--> statement-breakpoint
ALTER TABLE "opinion_columns" ADD COLUMN "review_notes" jsonb;--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");