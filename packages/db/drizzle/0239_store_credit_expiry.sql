-- Store credit follow-ups (12 Nov 2026).
-- 1. Optional expiry on a credit line: `expires_at` (null never expires). What is left of it on that
--    day leaves the balance with its own `expiry` ledger line, linked back by `expired_entry_id`.
--    The ledger stays append-only: these columns are written once, with the line.
-- 2. `gift_card_id`: a line that moved an old store-credit gift card into the balance. Unique, so
--    one card can never be credited twice.
-- Nullable columns and a wider kind check, so an older build keeps working during a rolling deploy.
ALTER TABLE "store_credit_entry" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD COLUMN IF NOT EXISTS "expired_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD COLUMN IF NOT EXISTS "gift_card_id" uuid;--> statement-breakpoint
ALTER TABLE "store_credit_entry" DROP CONSTRAINT IF EXISTS "store_credit_entry_kind_check";--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_kind_check" CHECK ("store_credit_entry"."kind" in ('adjustment', 'payment', 'refund', 'release', 'expiry'));--> statement-breakpoint
ALTER TABLE "store_credit_entry" DROP CONSTRAINT IF EXISTS "store_credit_entry_expiry_credit";--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_expiry_credit" CHECK ("store_credit_entry"."expires_at" is null or "store_credit_entry"."amount_paise" > 0);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_expired_entry_id_fk" FOREIGN KEY ("expired_entry_id") REFERENCES "public"."store_credit_entry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- One expiry line per credit line, ever.
CREATE UNIQUE INDEX IF NOT EXISTS "store_credit_entry_expired_once" ON "store_credit_entry" USING btree ("expired_entry_id") WHERE "store_credit_entry"."expired_entry_id" is not null;--> statement-breakpoint
-- One gift card moves into a balance once, ever.
CREATE UNIQUE INDEX IF NOT EXISTS "store_credit_entry_gift_card_once" ON "store_credit_entry" USING btree ("gift_card_id") WHERE "store_credit_entry"."gift_card_id" is not null;--> statement-breakpoint
-- The expiry sweep looks for credit lines whose day has come.
CREATE INDEX IF NOT EXISTS "store_credit_entry_expires" ON "store_credit_entry" USING btree ("expires_at") WHERE "store_credit_entry"."expires_at" is not null;--> statement-breakpoint
-- Store ids with a credit line past its expiry and no expiry line yet, for the worker's sweep
-- (the sweep then works per store under RLS). Ids only, same pattern as stores_with_balance_due.
CREATE OR REPLACE FUNCTION stores_with_store_credit_expiring(now_at timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT e.store_id FROM store_credit_entry e
  WHERE e.expires_at IS NOT NULL AND e.expires_at <= now_at
    AND e.expires_at > now_at - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM store_credit_entry x WHERE x.expired_entry_id = e.id);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_store_credit_expiring(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_store_credit_expiring(timestamptz) TO app;
