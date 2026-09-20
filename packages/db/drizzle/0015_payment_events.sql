CREATE TABLE "payment_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "payments" jsonb;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_provider_event" ON "payment_event" USING btree ("store_id","provider","event_id");--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_status_check" CHECK ("payment"."status" in ('pending', 'captured', 'refunded', 'failed'));