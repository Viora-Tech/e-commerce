CREATE TABLE IF NOT EXISTS "affiliate_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"discount_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "code_request" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_code" ADD CONSTRAINT "affiliate_code_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_code" ADD CONSTRAINT "affiliate_code_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_code_store_kind_code" ON "affiliate_code" USING btree ("store_id","kind","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_code_affiliate" ON "affiliate_code" USING btree ("store_id","affiliate_id");--> statement-breakpoint
INSERT INTO "affiliate_code" ("id", "store_id", "affiliate_id", "kind", "code", "created_at")
SELECT gen_random_uuid(), a."store_id", a."id", 'link', a."code", a."created_at" FROM "affiliate" a
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "affiliate_code" ("id", "store_id", "affiliate_id", "kind", "code", "discount_id", "created_at")
SELECT gen_random_uuid(), a."store_id", a."id", 'coupon', a."coupon_code", a."discount_id", coalesce(a."approved_at", a."created_at") FROM "affiliate" a
WHERE a."coupon_code" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
SELECT apply_store_rls();
