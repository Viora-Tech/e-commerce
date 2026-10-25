CREATE TABLE "affiliate_program" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "affiliate" ADD COLUMN "rate_override" jsonb;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "affiliate_program" ADD CONSTRAINT "affiliate_program_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_program_store_slug" ON "affiliate_program" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_program_store_default" ON "affiliate_program" USING btree ("store_id") WHERE is_default;--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_program_id_affiliate_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_store_program" ON "affiliate" USING btree ("store_id","program_id");--> statement-breakpoint
-- Affiliates v1.1: today's program becomes each store's default program. Every store with an
-- `affiliates` settings entry or any affiliate gets one program named "Default" whose rules are a
-- copy of the whole v1 entry (`ProgramRulesSchema` ignores the store-wide keys and fills the new
-- ones with defaults, so nothing an affiliate earns changes). The program keys stay in the store
-- entry, unread, so rolling the code back still works. Guarded, so a re-run adds nothing.
INSERT INTO "affiliate_program" ("id", "store_id", "name", "slug", "is_default", "rules")
SELECT gen_random_uuid(), s."id", 'Default', 'default', true,
  CASE WHEN jsonb_typeof(s."apps"->'settings'->'affiliates') = 'object'
    THEN s."apps"->'settings'->'affiliates' ELSE '{}'::jsonb END
FROM "store" s
WHERE (
    jsonb_typeof(s."apps"->'settings'->'affiliates') = 'object'
    OR EXISTS (SELECT 1 FROM "affiliate" a WHERE a."store_id" = s."id")
  )
  AND NOT EXISTS (SELECT 1 FROM "affiliate_program" p WHERE p."store_id" = s."id" AND p."is_default");
--> statement-breakpoint
UPDATE "affiliate" a SET "program_id" = p."id"
FROM "affiliate_program" p
WHERE p."store_id" = a."store_id" AND p."is_default" AND a."program_id" IS NULL;
--> statement-breakpoint
UPDATE "affiliate_commission" c SET "program_id" = a."program_id"
FROM "affiliate" a
WHERE a."id" = c."affiliate_id" AND c."program_id" IS NULL;
--> statement-breakpoint
SELECT apply_store_rls();