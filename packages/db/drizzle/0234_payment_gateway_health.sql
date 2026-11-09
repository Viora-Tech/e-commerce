-- A payment gateway that refused the store's API keys (Razorpay's 401 "Authentication failed" when
-- checkout creates its order). While `unhealthy_since` is set, checkout hides the gateway; from
-- `retest_after` on it runs the gateway's read-only key check and shows it again once that passes.
-- `alerted_at` is when the owner was told about the incident (once per incident). A new table, so
-- an older build that never reads it keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "payment_gateway_health" (
	"store_id" uuid NOT NULL,
	"gateway" text NOT NULL,
	"unhealthy_since" timestamp with time zone,
	"last_error" text,
	"last_failed_at" timestamp with time zone,
	"retest_after" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_gateway_health" ADD CONSTRAINT "payment_gateway_health_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateway_health_store_gateway" ON "payment_gateway_health" USING btree ("store_id","gateway");
--> statement-breakpoint
SELECT apply_store_rls();
