CREATE TABLE "usage_bill" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"month" text NOT NULL,
	"orders_counted" integer NOT NULL,
	"fee_orders" integer NOT NULL,
	"fee_paise" integer NOT NULL,
	"carried_in_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sales_order_id" uuid,
	"sales_order_number" integer,
	"merged_into_sales_order_id" uuid,
	"status" text NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_bill_status" CHECK ("usage_bill"."status" in ('carried','due','merged','paid','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "store_plan" ADD COLUMN "fair_use_notice_month" text;--> statement-breakpoint
ALTER TABLE "usage_bill" ADD CONSTRAINT "usage_bill_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_bill_month" ON "usage_bill" USING btree ("store_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_bill_order" ON "usage_bill" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "usage_bill_store" ON "usage_bill" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_bill_merged" ON "usage_bill" USING btree ("merged_into_sales_order_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The store a usage bill belongs to, for the sales store's order.paid and cancel hooks (RLS hides
-- it there): the bill's own order, or the plan bill's order it was added to.
CREATE OR REPLACE FUNCTION usage_bill_store(sales_order uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM usage_bill
  WHERE sales_order_id = sales_order OR merged_into_sales_order_id = sales_order
  LIMIT 1;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION usage_bill_store(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION usage_bill_store(uuid) TO app;--> statement-breakpoint
-- Stores with a paid plan period overlapping [from, to): the only ones a month's per-order fee
-- or fair-use check can apply to.
CREATE OR REPLACE FUNCTION stores_with_paid_period(from_at timestamptz, to_at timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM plan_payment
  WHERE status = 'paid' AND period_start < to_at AND period_end > from_at;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_paid_period(timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_paid_period(timestamptz, timestamptz) TO app;
