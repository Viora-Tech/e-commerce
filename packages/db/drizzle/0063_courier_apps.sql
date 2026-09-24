CREATE TABLE "courier_wallet_balance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"balance_paise" integer DEFAULT 0 NOT NULL,
	"low_balance_threshold_paise" integer DEFAULT 50000 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_manifest" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"pickup_id" uuid,
	"shipment_ids" uuid[] DEFAULT '{}' NOT NULL,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_pickup" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"scheduled_for" date NOT NULL,
	"time_from" text NOT NULL,
	"time_to" text,
	"expected_package_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"provider_ref" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_webhook_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"waybill" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "length_cm" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "width_cm" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "insured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "declared_value_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_reason" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_raised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_action" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "ndr_action_ref" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "rto_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "pickup_id" uuid;--> statement-breakpoint
ALTER TABLE "courier_wallet_balance" ADD CONSTRAINT "courier_wallet_balance_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_manifest" ADD CONSTRAINT "shipment_manifest_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_manifest" ADD CONSTRAINT "shipment_manifest_pickup_id_shipment_pickup_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."shipment_pickup"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_pickup" ADD CONSTRAINT "shipment_pickup_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_webhook_event" ADD CONSTRAINT "shipment_webhook_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courier_wallet_balance_store_provider" ON "courier_wallet_balance" USING btree ("store_id","provider");--> statement-breakpoint
CREATE INDEX "shipment_manifest_store" ON "shipment_manifest" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "shipment_pickup_store" ON "shipment_pickup" USING btree ("store_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_webhook_event_provider_event" ON "shipment_webhook_event" USING btree ("store_id","provider","event_id");--> statement-breakpoint
CREATE INDEX "shipment_store_ndr" ON "shipment" USING btree ("store_id","ndr_status");--> statement-breakpoint
CREATE INDEX "shipment_pickup_id" ON "shipment" USING btree ("pickup_id");--> statement-breakpoint
SELECT apply_store_rls();