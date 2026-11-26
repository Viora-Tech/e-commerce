-- Founding merchant offer (owner, 27 Nov 2026): the first 20 stores to sign up get a 30-day
-- trial, then Growth at ₹999 a month for 12 billing months. Additive only: two new columns with
-- safe defaults and a counting function, so a same-day rollback keeps working.
ALTER TABLE "store_plan" ADD COLUMN IF NOT EXISTS "founding_offer_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_payment" ADD COLUMN IF NOT EXISTS "founding_offer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Places taken so far, across every store (store_plan is behind RLS). Sign-up calls it under
-- pg_advisory_xact_lock(hashtext('founding_offer')), so two sign-ups at once never both take
-- the last place.
CREATE OR REPLACE FUNCTION founding_offer_taken() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM store_plan WHERE founding_offer_at IS NOT NULL;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION founding_offer_taken() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION founding_offer_taken() TO app;
