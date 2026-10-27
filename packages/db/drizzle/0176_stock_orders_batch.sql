CREATE TABLE "courier_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_order_id" text,
	"external_shipment_id" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "gift_card_id" uuid;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD COLUMN "expected_at" date;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD COLUMN "tracked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "courier_order" ADD CONSTRAINT "courier_order_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_order" ADD CONSTRAINT "courier_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courier_order_order_provider" ON "courier_order" USING btree ("order_id","provider");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Stores with a courier that takes pending orders (Shiprocket, RapidShyp) enabled, for the
-- order push job (core shipping/order-push.ts). Read across stores, so SECURITY DEFINER.
CREATE OR REPLACE FUNCTION stores_with_order_push_couriers() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store
  WHERE shipping -> 'enabled' ?| array['shiprocket', 'rapidshyp'];
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_order_push_couriers() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_order_push_couriers() TO app;
