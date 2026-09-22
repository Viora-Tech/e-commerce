CREATE TABLE IF NOT EXISTS "theme_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"template" text NOT NULL,
	"suffix" text DEFAULT '' NOT NULL,
	"sections" jsonb NOT NULL,
	"draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_template_kind" CHECK ("theme_template"."template" in ('home','product','collection','page','blog','article','cart','search','not_found','header','footer')),
	CONSTRAINT "theme_template_suffix" CHECK ("theme_template"."suffix" ~ '^[a-z0-9-]{0,40}$')
);
--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "template_suffix" text;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "body" jsonb;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "seo_title" text;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "seo_description" text;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "template_suffix" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "template_suffix" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_template" ADD CONSTRAINT "theme_template_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_template" ADD CONSTRAINT "theme_template_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "theme_template_unique" ON "theme_template" USING btree ("theme_id","template","suffix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_template_store" ON "theme_template" USING btree ("store_id");--> statement-breakpoint
-- Backfill (idempotent). Every theme takes over the published home page and every
-- other Puck page as a `page.<handle>` alternate, so the storefront looks the same;
-- every theme gets its header and footer section groups.
INSERT INTO "theme_template" ("id", "store_id", "theme_id", "template", "suffix", "sections")
SELECT gen_random_uuid(), t."store_id", t."id", 'home', '', coalesce(p."published_data", p."data")
FROM "theme" t JOIN "page" p ON p."store_id" = t."store_id" AND p."handle" = 'home'
ON CONFLICT ("theme_id", "template", "suffix") DO NOTHING;--> statement-breakpoint
INSERT INTO "theme_template" ("id", "store_id", "theme_id", "template", "suffix", "sections")
SELECT gen_random_uuid(), t."store_id", t."id", 'page', left(p."handle", 40), coalesce(p."published_data", p."data")
FROM "theme" t JOIN "page" p ON p."store_id" = t."store_id" AND p."handle" <> 'home'
WHERE jsonb_array_length(coalesce(coalesce(p."published_data", p."data")->'content', '[]'::jsonb)) > 0
ON CONFLICT ("theme_id", "template", "suffix") DO NOTHING;--> statement-breakpoint
UPDATE "page" p SET "template_suffix" = left(p."handle", 40)
WHERE p."handle" <> 'home' AND p."template_suffix" IS NULL
	AND EXISTS (SELECT 1 FROM "theme_template" tt WHERE tt."store_id" = p."store_id" AND tt."template" = 'page' AND tt."suffix" = left(p."handle", 40));--> statement-breakpoint
INSERT INTO "theme_template" ("id", "store_id", "theme_id", "template", "suffix", "sections")
SELECT gen_random_uuid(), t."store_id", t."id", g.kind, '',
	jsonb_build_object('root', jsonb_build_object('props', '{}'::jsonb), 'zones', '{}'::jsonb,
		'content', jsonb_build_array(jsonb_build_object('type', g.section, 'props', jsonb_build_object('id', g.kind))))
FROM "theme" t CROSS JOIN (VALUES ('header', 'Header'), ('footer', 'Footer')) AS g(kind, section)
ON CONFLICT ("theme_id", "template", "suffix") DO NOTHING;--> statement-breakpoint
SELECT apply_store_rls();
