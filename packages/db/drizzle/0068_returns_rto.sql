CREATE TABLE "return_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text DEFAULT 'return' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text,
	"customer_note" text,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"decision_note" text,
	"resolution" text,
	"refund_amount_paise" integer,
	"refund_ids" uuid[] DEFAULT '{}' NOT NULL,
	"gift_card_id" uuid,
	"exchange_order_id" uuid,
	"reship_shipment_id" uuid,
	"shipment_id" uuid,
	"restock" boolean DEFAULT true NOT NULL,
	"restocked_at" timestamp with time zone,
	"condition" text,
	"condition_note" text,
	"pickup_method" text,
	"pickup_provider" text,
	"pickup_waybill" text,
	"pickup_label_url" text,
	"courier_cost_paise" integer,
	"requested_by" text DEFAULT 'customer' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"pickup_arranged_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_request_status_check" CHECK ("return_request"."status" in ('requested', 'approved', 'rejected', 'in_transit', 'received', 'resolved', 'cancelled')),
	CONSTRAINT "return_request_kind_check" CHECK ("return_request"."kind" in ('return', 'rto'))
);
--> statement-breakpoint
CREATE TABLE "return_request_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"return_request_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"restocked_quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "return_request_line_quantity_check" CHECK ("return_request_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "returns" jsonb;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_line" ADD CONSTRAINT "return_request_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_line" ADD CONSTRAINT "return_request_line_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_line" ADD CONSTRAINT "return_request_line_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "return_request_store_number" ON "return_request" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "return_request_store_status" ON "return_request" USING btree ("store_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "return_request_order" ON "return_request" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_request_rto_shipment" ON "return_request" USING btree ("shipment_id") WHERE "return_request"."kind" = 'rto';--> statement-breakpoint
CREATE INDEX "return_request_line_request" ON "return_request_line" USING btree ("return_request_id");--> statement-breakpoint
CREATE INDEX "return_request_line_order_line" ON "return_request_line" USING btree ("order_line_id");--> statement-breakpoint
SELECT apply_store_rls();