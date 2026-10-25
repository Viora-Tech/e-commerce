-- COD & RTO app: an RTO risk score and the COD confirmation answer on each order, plus the
-- returns gaps (the shopper's preferred outcome, exchange variants, auto-approved returns).
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "rto_risk" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "cod_verification" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "cod_verify_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "cod_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN IF NOT EXISTS "preferred_resolution" text;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN IF NOT EXISTS "auto_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "return_request_line" ADD COLUMN IF NOT EXISTS "exchange_variant_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_cod_verification_open" ON "order" USING btree ("store_id","cod_verify_requested_at") WHERE "order"."cod_verification" in ('pending', 'unconfirmed');--> statement-breakpoint
-- Store ids with COD orders still waiting for the shopper's answer, for the worker's sweep
-- (flag, then the optional auto-cancel). Ids only, same pattern as stores_with_pending_manual_orders (0061).
CREATE OR REPLACE FUNCTION stores_with_pending_cod_checks() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE cod_verification in ('pending', 'unconfirmed')
    AND status = 'open';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pending_cod_checks() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pending_cod_checks() TO app;
