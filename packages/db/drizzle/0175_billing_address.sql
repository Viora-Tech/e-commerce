ALTER TABLE "customer_address" ADD COLUMN "is_default_billing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_address" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "customer_address" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_address_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_billing_address_id_address_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."address"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_address_one_default_billing" ON "customer_address" USING btree ("customer_id") WHERE is_default_billing;