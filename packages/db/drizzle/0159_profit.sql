-- Profit you can trust: a packing snapshot on each consignment, and the store's monthly running costs.
-- Idempotent, so a re-run (or a database that already has part of it) is a no-op.
CREATE TABLE IF NOT EXISTS "monthly_expense" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"amount_paise" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_expense_category_check" CHECK ("monthly_expense"."category" in ('staff', 'rent', 'software', 'marketing', 'utilities', 'services', 'other')),
	CONSTRAINT "monthly_expense_amount_check" CHECK ("monthly_expense"."amount_paise" >= 0),
	CONSTRAINT "monthly_expense_range_check" CHECK ("monthly_expense"."ends_on" is null or "monthly_expense"."ends_on" >= "monthly_expense"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "packing_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "box_preset_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "monthly_expense" ADD CONSTRAINT "monthly_expense_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_expense_store_starts" ON "monthly_expense" USING btree ("store_id","starts_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_expense_series" ON "monthly_expense" USING btree ("series_id");--> statement-breakpoint
SELECT apply_store_rls();
