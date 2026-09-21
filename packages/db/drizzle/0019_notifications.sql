CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"to" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_ref" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "notifications" jsonb;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_order_channel_template" ON "notification" USING btree ("order_id","channel","template");--> statement-breakpoint
SELECT apply_store_rls();