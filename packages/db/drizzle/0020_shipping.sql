CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"waybill" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"label_url" text,
	"tracking_url" text,
	"tracking" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "shipping" jsonb;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_provider_waybill" ON "shipment" USING btree ("provider","waybill");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The tracking job runs on the app role and needs to know WHICH stores have
-- parcels in flight before it can scope a transaction to each. SECURITY
-- DEFINER exposes only the store ids, nothing about the shipments.
CREATE OR REPLACE FUNCTION stores_with_open_shipments() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM shipment
  WHERE status IN ('created', 'picked_up', 'in_transit', 'out_for_delivery');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_open_shipments() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_open_shipments() TO app;
