-- Unpaid checkouts as drafts (docs/design/unpaid-checkouts-as-drafts.md). A checkout that picks
-- an online or UPI / bank transfer payment is saved as a draft until the money arrives, then it
-- takes an order number. `draft_source` says who made a draft: 'checkout' (a shopper's unpaid
-- checkout) or 'staff' (built in the admin). `draft_expired_at` is set when a checkout draft
-- stops waiting for payment. `last_activity_at` is when the shopper last touched a checkout
-- draft (made it, or checked out the same items again): the "same items again" match (24 h by
-- default), the 7-day expiry and the Drafts list all count from it. All nullable, so an older build that writes neither keeps
-- working during a rolling deploy; null reads as a staff draft.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "draft_source" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "draft_expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order" ADD CONSTRAINT "order_draft_source_check" CHECK ("draft_source" in ('checkout', 'staff'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- Every draft so far was made by staff. Drafts are few, so this touches few rows.
UPDATE "order" SET "draft_source" = 'staff' WHERE "draft_number" IS NOT NULL AND "draft_source" IS NULL;--> statement-breakpoint
-- The Drafts page's "From checkout" tab, the repeat-checkout match and the 7-day expiry read open
-- checkout drafts by last activity.
CREATE INDEX IF NOT EXISTS "order_store_checkout_drafts" ON "order" USING btree ("store_id","last_activity_at") WHERE "order"."status" = 'draft' AND "order"."draft_source" = 'checkout';
--> statement-breakpoint
-- Stores with open (not expired) checkout drafts, for the worker's payment nudge and 7-day expiry.
CREATE OR REPLACE FUNCTION stores_with_open_checkout_drafts() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'draft'
    AND draft_source = 'checkout'
    AND draft_expired_at IS NULL;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_open_checkout_drafts() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_open_checkout_drafts() TO app;
