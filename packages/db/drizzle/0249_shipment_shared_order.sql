-- One box, several orders ("Same box as #A", owner 15 Nov 2026: #2462 and #2464 went out under
-- one Delhivery AWB). `shipment_shared_order` lists the extra orders a shipment carries; the shipment
-- stays on the order it was booked for. A new table, so an older build that never reads it keeps
-- working during a rolling deploy. The RTO task index widens from one per shipment to one per
-- shipment and order, so a shared box that comes back opens a task on each order it carried;
-- every existing row still satisfies it.
CREATE TABLE IF NOT EXISTS "shipment_shared_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"fulfillment_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_shared_order" ADD CONSTRAINT "shipment_shared_order_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_shared_order" ADD CONSTRAINT "shipment_shared_order_shipment_id_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_shared_order" ADD CONSTRAINT "shipment_shared_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_shared_order" ADD CONSTRAINT "shipment_shared_order_fulfillment_order_id_fulfillment_order_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_order"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_shared_order_shipment_order" ON "shipment_shared_order" USING btree ("shipment_id","order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_shared_order_order" ON "shipment_shared_order" USING btree ("order_id");--> statement-breakpoint
DROP INDEX IF EXISTS "return_request_rto_shipment";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "return_request_rto_shipment" ON "return_request" USING btree ("shipment_id","order_id") WHERE "return_request"."kind" = 'rto';--> statement-breakpoint
SELECT apply_store_rls();
