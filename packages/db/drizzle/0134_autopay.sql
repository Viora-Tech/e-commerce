CREATE TABLE "autopay_mandate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"interval" text NOT NULL,
	"subscription_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"short_url" text,
	"last_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "autopay_mandate_status" CHECK ("autopay_mandate"."status" in ('created','active','halted','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "autopay_mandate" ADD CONSTRAINT "autopay_mandate_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autopay_mandate_store" ON "autopay_mandate" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "autopay_mandate_subscription" ON "autopay_mandate" USING btree ("subscription_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The store a Razorpay subscription belongs to, for the AutoPay webhook (no store context yet).
CREATE OR REPLACE FUNCTION autopay_store(p_subscription text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM autopay_mandate WHERE subscription_id = p_subscription;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION autopay_store(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION autopay_store(text) TO app;
