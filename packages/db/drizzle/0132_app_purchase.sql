CREATE TABLE "app_purchase" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plugin_id" text NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_number" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_purchase_status" CHECK ("app_purchase"."status" in ('due','active','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "app_purchase" ADD CONSTRAINT "app_purchase_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_purchase_store" ON "app_purchase" USING btree ("store_id","plugin_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "app_purchase_order" ON "app_purchase" USING btree ("sales_order_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The store an app bill belongs to, for the sales store's order.paid hook (RLS hides it there).
CREATE OR REPLACE FUNCTION app_purchase_store(sales_order uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM app_purchase WHERE sales_order_id = sales_order;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_purchase_store(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_purchase_store(uuid) TO app;--> statement-breakpoint
-- Stores with a bought app ending within 3 days of `at` (renewal to bill) or an unpaid app bill.
CREATE OR REPLACE FUNCTION stores_with_app_renewals(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM app_purchase
  WHERE (status = 'active' AND period_end < at + interval '3 days') OR status = 'due';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_app_renewals(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_app_renewals(timestamptz) TO app;
