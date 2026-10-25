CREATE TABLE "purchase_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"inbound_shipment_id" uuid,
	"kind" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"extracted" jsonb,
	"raw_text" text,
	"error" text,
	"applied_at" timestamp with time zone,
	"applied_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_document_kind_check" CHECK ("purchase_document"."kind" in ('supplier_invoice', 'bill_of_entry', 'freight_bill', 'cha_bill', 'bank_advice', 'other')),
	CONSTRAINT "purchase_document_status_check" CHECK ("purchase_document"."status" in ('pending', 'reading', 'ready', 'failed', 'applied')),
	CONSTRAINT "purchase_document_owner_check" CHECK (num_nonnulls("purchase_document"."purchase_order_id", "purchase_document"."inbound_shipment_id") >= 1)
);
--> statement-breakpoint
ALTER TABLE "purchase_document" ADD CONSTRAINT "purchase_document_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_document" ADD CONSTRAINT "purchase_document_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_document" ADD CONSTRAINT "purchase_document_inbound_shipment_id_inbound_shipment_id_fk" FOREIGN KEY ("inbound_shipment_id") REFERENCES "public"."inbound_shipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_document_store_order" ON "purchase_document" USING btree ("store_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_document_store_shipment" ON "purchase_document" USING btree ("store_id","inbound_shipment_id");--> statement-breakpoint
SELECT apply_store_rls();
