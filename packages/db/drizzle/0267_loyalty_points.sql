-- Loyalty points app (docs/design/loyalty-points.md): points are store credit (1 point = ₹1) on
-- a new `loyalty` store credit kind; `loyalty_entry` says why each point came or went and holds
-- points still waiting for an order's return window; the customer gets an optional birthday
-- (`MM-DD`). Additive only: the kind check is widened, never narrowed.
ALTER TABLE "store_credit_entry" DROP CONSTRAINT IF EXISTS "store_credit_entry_kind_check";
--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_kind_check" CHECK ("store_credit_entry"."kind" in ('adjustment', 'payment', 'refund', 'release', 'expiry', 'loyalty'));
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "birthday" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"points" integer NOT NULL,
	"order_id" uuid,
	"product_id" uuid,
	"year" integer,
	"reason" text NOT NULL,
	"staff_email" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credited_at" timestamp with time zone,
	"store_credit_entry_id" uuid,
	"expires_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_entry_points_nonzero" CHECK ("loyalty_entry"."points" <> 0),
	CONSTRAINT "loyalty_entry_source_check" CHECK ("loyalty_entry"."source" in ('order', 'review', 'birthday', 'adjustment', 'reversal')),
	CONSTRAINT "loyalty_entry_status_check" CHECK ("loyalty_entry"."status" in ('pending', 'credited', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_store_credit_entry_id_store_credit_entry_id_fk" FOREIGN KEY ("store_credit_entry_id") REFERENCES "public"."store_credit_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_entry_order_once" ON "loyalty_entry" USING btree ("store_id","order_id") WHERE "loyalty_entry"."source" = 'order';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_entry_review_once" ON "loyalty_entry" USING btree ("store_id","customer_id","product_id") WHERE "loyalty_entry"."source" = 'review';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_entry_birthday_once" ON "loyalty_entry" USING btree ("store_id","customer_id","year") WHERE "loyalty_entry"."source" = 'birthday';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_entry_customer" ON "loyalty_entry" USING btree ("store_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_entry_due" ON "loyalty_entry" USING btree ("store_id","status","available_at");--> statement-breakpoint
-- Stores with the Loyalty points app installed, for the worker's hourly sweep (it then works per
-- store under RLS). Ids only, same pattern as stores_with_due_affiliate_commissions (0158).
CREATE OR REPLACE FUNCTION stores_with_loyalty_points() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store WHERE apps -> 'installed' ? 'loyalty';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_loyalty_points() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_loyalty_points() TO app;
--> statement-breakpoint
SELECT apply_store_rls();
