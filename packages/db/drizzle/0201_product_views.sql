CREATE TABLE "product_view" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_automation_run" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "product_view" ADD CONSTRAINT "product_view_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_view" ADD CONSTRAINT "product_view_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_view" ADD CONSTRAINT "product_view_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_view_shopper_product" ON "product_view" USING btree ("store_id","customer_id","product_id");--> statement-breakpoint
CREATE INDEX "product_view_store_viewed" ON "product_view" USING btree ("store_id","viewed_at");--> statement-breakpoint
-- The automations tick also visits stores with an On "Browse abandoned" workflow (a sweep trigger).
CREATE OR REPLACE FUNCTION stores_with_automation_work() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM automation_run
    WHERE status IN ('queued', 'running', 'waiting') AND next_at <= now()
  UNION
  SELECT store_id FROM automation_step_run
    WHERE status = 'awaiting_approval' AND approval_expires_at <= now()
  UNION
  SELECT store_id FROM automation_workflow
    WHERE status = 'on' AND trigger_type = 'schedule' AND (next_fire_at IS NULL OR next_fire_at <= now())
  UNION
  -- Sweep triggers (abandoned checkout, cart and browsing, lapsed customers) look every tick.
  SELECT store_id FROM automation_workflow
    WHERE status = 'on'
      AND trigger_type IN ('checkout.abandoned', 'cart.abandoned', 'browse.abandoned', 'customer.lapsed');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_automation_work() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_automation_work() TO app;
--> statement-breakpoint
SELECT apply_store_rls();
