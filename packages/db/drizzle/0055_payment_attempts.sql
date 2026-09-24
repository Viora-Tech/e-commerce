-- Payment attempts: one row per try, an idempotency key per attempt, forward-only
-- statuses, and at most one gateway capture per order (extra captures are flagged
-- refund-needed instead). Pattern from Saleor's TransactionItem (BSD-3).
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_status_check";--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "gateway_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "error" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refund_needed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "multi_capture" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_store_idempotency_key" ON "payment" USING btree ("store_id","idempotency_key") WHERE "payment"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_one_capture_per_order" ON "payment" USING btree ("store_id","order_id") WHERE "payment"."status" = 'captured' and "payment"."provider" <> 'gift_card' and not "payment"."multi_capture" and not "payment"."refund_needed";--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_status_check" CHECK ("payment"."status" in ('created', 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'));
