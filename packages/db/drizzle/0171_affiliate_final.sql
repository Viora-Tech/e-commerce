CREATE TABLE IF NOT EXISTS "affiliate_click_day" (
	"store_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "affiliate_click_day_store_id_affiliate_id_day_pk" PRIMARY KEY("store_id","affiliate_id","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_creative" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"program_id" uuid,
	"media_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "reject_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click_day" ADD CONSTRAINT "affiliate_click_day_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click_day" ADD CONSTRAINT "affiliate_click_day_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_creative" ADD CONSTRAINT "affiliate_creative_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_creative" ADD CONSTRAINT "affiliate_creative_program_id_affiliate_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_program"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_creative" ADD CONSTRAINT "affiliate_creative_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_creative_store" ON "affiliate_creative" USING btree ("store_id","archived_at","sort");--> statement-breakpoint
SELECT apply_store_rls();
