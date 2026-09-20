CREATE TABLE "address" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state_code" text NOT NULL,
	"pincode" text NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	"phone" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_address_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "variant_title" text;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shipping_address_id_address_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."address"("id") ON DELETE no action ON UPDATE no action;