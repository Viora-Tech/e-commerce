-- Meta's delivery reports (delivered, read, failed) land on the message they are about, found by
-- the WhatsApp message id we keep in provider_ref. Additive only: two nullable columns and two
-- partial indexes (rows without a provider reference are never looked up).
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "delivery_status" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "delivery_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_provider_ref" ON "notification" USING btree ("provider_ref") WHERE "provider_ref" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_message_provider_ref" ON "marketing_message" USING btree ("provider_ref") WHERE "provider_ref" is not null;
