CREATE TABLE "plan_payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"interval" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_number" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_payment_status" CHECK ("plan_payment"."status" in ('due','paid','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "store_plan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"plan" text DEFAULT 'growth' NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"next_plan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_plan_plan" CHECK ("store_plan"."plan" in ('starter','growth','pro')),
	CONSTRAINT "store_plan_interval" CHECK ("store_plan"."interval" in ('month','year')),
	CONSTRAINT "store_plan_status" CHECK ("store_plan"."status" in ('trialing','active','due','paused','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "plan_payment" ADD CONSTRAINT "plan_payment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_plan" ADD CONSTRAINT "store_plan_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_payment_store" ON "plan_payment" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_payment_order" ON "plan_payment" USING btree ("sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_plan_store" ON "store_plan" USING btree ("store_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The store a plan bill belongs to, for the sales store's order.paid hook (RLS hides it there).
CREATE OR REPLACE FUNCTION plan_payment_store(sales_order uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM plan_payment WHERE sales_order_id = sales_order;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION plan_payment_store(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION plan_payment_store(uuid) TO app;--> statement-breakpoint
-- Stores whose plan needs the billing sweep: a trial or period ending within 3 days of `at`,
-- or a bill still due.
CREATE OR REPLACE FUNCTION stores_with_plan_due(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM store_plan
  WHERE status = 'due'
    OR (status = 'trialing' AND trial_ends_at < at + interval '3 days')
    OR (status = 'active' AND period_end < at + interval '3 days');
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_plan_due(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_plan_due(timestamptz) TO app;
