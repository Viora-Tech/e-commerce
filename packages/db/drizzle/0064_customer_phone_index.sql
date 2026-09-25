ALTER TABLE "customer" ADD COLUMN "phone_index" text;--> statement-breakpoint
CREATE INDEX "customer_store_phone_index" ON "customer" USING btree ("store_id","phone_index");