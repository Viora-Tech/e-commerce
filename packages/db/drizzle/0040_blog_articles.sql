CREATE TABLE IF NOT EXISTS "blog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"comment_policy" text DEFAULT 'disabled' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"blog_id" uuid NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"body" jsonb,
	"excerpt" text,
	"image_media_id" uuid,
	"image_alt" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog" DROP CONSTRAINT IF EXISTS "blog_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "blog" ADD CONSTRAINT "blog_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" DROP CONSTRAINT IF EXISTS "article_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" DROP CONSTRAINT IF EXISTS "article_blog_id_blog_id_fk";--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_blog_id_blog_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" DROP CONSTRAINT IF EXISTS "article_image_media_id_media_id_fk";--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_store_handle" ON "blog" USING btree ("store_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "article_blog_handle" ON "article" USING btree ("blog_id","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_store_published" ON "article" USING btree ("store_id","status","published_at");--> statement-breakpoint
-- Every existing store starts with a "News" blog, as Shopify does.
INSERT INTO "blog" ("id", "store_id", "title", "handle")
SELECT gen_random_uuid(), s."id", 'News', 'news'
FROM "store" s
WHERE NOT EXISTS (SELECT 1 FROM "blog" b WHERE b."store_id" = s."id");
--> statement-breakpoint
SELECT apply_store_rls();
