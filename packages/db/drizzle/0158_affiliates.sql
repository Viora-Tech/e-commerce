CREATE TABLE "affiliate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid,
	"code" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone_index" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"social" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"discount_id" uuid,
	"coupon_code" text,
	"payout_method" text,
	"payout_details" text,
	"payout_hint" text,
	"has_pan" boolean DEFAULT false NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_commission" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"base_paise" integer NOT NULL,
	"earned_paise" integer NOT NULL,
	"commission_paise" integer NOT NULL,
	"tds_paise" integer DEFAULT 0 NOT NULL,
	"flag" text,
	"placed_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"eligible_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reversed_reason" text,
	"payout_id" uuid,
	"clawback_paise" integer DEFAULT 0 NOT NULL,
	"clawback_payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"gross_paise" integer NOT NULL,
	"tds_paise" integer DEFAULT 0 NOT NULL,
	"clawback_paise" integer DEFAULT 0 NOT NULL,
	"net_paise" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_payout_id_affiliate_payout_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_clawback_payout_id_affiliate_payout_id_fk" FOREIGN KEY ("clawback_payout_id") REFERENCES "public"."affiliate_payout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_store_code" ON "affiliate" USING btree ("store_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_store_customer" ON "affiliate" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "affiliate_store_status" ON "affiliate" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commission_store_order" ON "affiliate_commission" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "affiliate_commission_store_affiliate" ON "affiliate_commission" USING btree ("store_id","affiliate_id","status");--> statement-breakpoint
CREATE INDEX "affiliate_commission_store_due" ON "affiliate_commission" USING btree ("store_id","status","eligible_at");--> statement-breakpoint
CREATE INDEX "affiliate_commission_store_customer" ON "affiliate_commission" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "affiliate_payout_store_status" ON "affiliate_payout" USING btree ("store_id","status","created_at");--> statement-breakpoint
-- Store ids with affiliate commissions whose hold is over (Affiliates app), for the worker's
-- hourly approval sweep (the sweep then works per store under RLS). Ids only, same pattern as
-- stores_with_due_review_requests (0091).
CREATE OR REPLACE FUNCTION stores_with_due_affiliate_commissions() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM affiliate_commission
  WHERE status = 'pending' AND flag IS NULL AND eligible_at <= now();
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_due_affiliate_commissions() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_due_affiliate_commissions() TO app;
--> statement-breakpoint
SELECT apply_store_rls();