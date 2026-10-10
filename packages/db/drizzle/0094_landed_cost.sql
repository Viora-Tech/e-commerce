CREATE TABLE "inbound_shipment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"reference" text,
	"bill_of_entry_no" text,
	"bill_of_entry_date" date,
	"port" text,
	"arrived_at" timestamp with time zone,
	"status" text DEFAULT 'in_transit' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_shipment_status_check" CHECK ("inbound_shipment"."status" in ('in_transit', 'at_port', 'cleared', 'delivered'))
);
--> statement-breakpoint
CREATE TABLE "purchase_charge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"inbound_shipment_id" uuid,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"fx_rate" numeric(18, 6) DEFAULT '1' NOT NULL,
	"gst_paise" bigint DEFAULT 0 NOT NULL,
	"recoverable" boolean DEFAULT false NOT NULL,
	"split_method" text NOT NULL,
	"split_line_ids" jsonb,
	"manual_splits" jsonb,
	"payee" text,
	"note" text,
	"incurred_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_charge_kind_check" CHECK ("purchase_charge"."kind" in ('goods_adjustment', 'freight_insurance', 'customs_bcd', 'customs_sws', 'customs_igst', 'cha_fee', 'port_handling', 'freight_local', 'bank_fx', 'other')),
	CONSTRAINT "purchase_charge_split_method_check" CHECK ("purchase_charge"."split_method" in ('by_weight', 'by_value', 'by_quantity', 'specific_lines', 'manual')),
	CONSTRAINT "purchase_charge_owner_check" CHECK (num_nonnulls("purchase_charge"."purchase_order_id", "purchase_charge"."inbound_shipment_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "purchase_charge_split" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_receipt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"received_by" text,
	"note" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_receipt_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"landed_unit_cost_paise" integer NOT NULL,
	"cost_before_paise" integer,
	"cost_after_paise" integer
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"payment_terms" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "inbound_shipment_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "fx_rate" numeric(18, 6) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "rejected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "unit_price_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "landed_unit_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "costed_units" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "booked_cost_paise" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD CONSTRAINT "inbound_shipment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge" ADD CONSTRAINT "purchase_charge_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge" ADD CONSTRAINT "purchase_charge_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge" ADD CONSTRAINT "purchase_charge_inbound_shipment_id_inbound_shipment_id_fk" FOREIGN KEY ("inbound_shipment_id") REFERENCES "public"."inbound_shipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge_split" ADD CONSTRAINT "purchase_charge_split_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge_split" ADD CONSTRAINT "purchase_charge_split_charge_id_purchase_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."purchase_charge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_charge_split" ADD CONSTRAINT "purchase_charge_split_purchase_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt" ADD CONSTRAINT "purchase_order_receipt_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt" ADD CONSTRAINT "purchase_order_receipt_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt" ADD CONSTRAINT "purchase_order_receipt_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt_line" ADD CONSTRAINT "purchase_order_receipt_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt_line" ADD CONSTRAINT "purchase_order_receipt_line_receipt_id_purchase_order_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."purchase_order_receipt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipt_line" ADD CONSTRAINT "purchase_order_receipt_line_purchase_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_shipment_store_number" ON "inbound_shipment" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "purchase_charge_store_order" ON "purchase_charge" USING btree ("store_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_charge_store_shipment" ON "purchase_charge" USING btree ("store_id","inbound_shipment_id");--> statement-breakpoint
CREATE INDEX "purchase_charge_split_charge" ON "purchase_charge_split" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "purchase_charge_split_line" ON "purchase_charge_split" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "purchase_order_receipt_order" ON "purchase_order_receipt" USING btree ("store_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_receipt_line_receipt" ON "purchase_order_receipt_line" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "supplier_store_name" ON "supplier" USING btree ("store_id","name");--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_inbound_shipment_id_inbound_shipment_id_fk" FOREIGN KEY ("inbound_shipment_id") REFERENCES "public"."inbound_shipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_order_store_shipment" ON "purchase_order" USING btree ("store_id","inbound_shipment_id");--> statement-breakpoint
CREATE INDEX "purchase_order_store_supplier" ON "purchase_order" USING btree ("store_id","supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_order" ON "purchase_order_line" USING btree ("purchase_order_id");--> statement-breakpoint
-- Existing lines were priced in rupees: the supplier price in minor units is the same paise.
UPDATE "purchase_order_line" SET "unit_price_minor" = "unit_cost_paise";
--> statement-breakpoint
-- The old Shipping and Taxes fields become charges, so one list holds every cost of an order.
-- Shipping is product cost (split by value). Taxes were GST on the purchase: input credit,
-- so recoverable and kept out of landed cost. The old columns are no longer read or written.
INSERT INTO "purchase_charge" ("id", "store_id", "purchase_order_id", "kind", "amount_minor", "currency", "fx_rate", "recoverable", "split_method", "note")
SELECT gen_random_uuid(), "store_id", "id", 'freight_local', "shipping_paise", 'INR', 1, false, 'by_value', 'Shipping (from the old Shipping field)'
FROM "purchase_order" WHERE "shipping_paise" > 0;
--> statement-breakpoint
INSERT INTO "purchase_charge" ("id", "store_id", "purchase_order_id", "kind", "amount_minor", "currency", "fx_rate", "recoverable", "split_method", "note")
SELECT gen_random_uuid(), "store_id", "id", 'other', "tax_paise", 'INR', 1, true, 'by_value', 'Taxes (from the old Taxes field)'
FROM "purchase_order" WHERE "tax_paise" > 0;
--> statement-breakpoint
SELECT apply_store_rls();
