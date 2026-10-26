CREATE TABLE "article_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_likes" (
	"reader_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_likes_reader_id_slug_pk" PRIMARY KEY("reader_id","slug")
);
--> statement-breakpoint
CREATE TABLE "reader_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"reader_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"display_key" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readers_email_unique" UNIQUE("email"),
	CONSTRAINT "readers_display_key_unique" UNIQUE("display_key")
);
--> statement-breakpoint
ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_sessions" ADD CONSTRAINT "reader_sessions_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_comments_slug_idx" ON "article_comments" USING btree ("slug","created_at");--> statement-breakpoint
CREATE INDEX "article_likes_slug_idx" ON "article_likes" USING btree ("slug");