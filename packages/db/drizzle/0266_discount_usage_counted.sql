-- A coupon on an unpaid checkout draft is noted but not counted against its limits until the
-- payment succeeds (a failed payment used to block the shopper's code for up to 7 days).
-- Existing rows were counted when written, so they default to true. Additive only.
ALTER TABLE "discount_usage" ADD COLUMN IF NOT EXISTS "counted" boolean DEFAULT true NOT NULL;
