-- Store credit at checkout (step 2). A checkout that spends store credit holds it as a `pending`
-- payment row (provider `store_credit`) until the gateway is paid, and gives it back with a
-- `release` ledger line when the order is cancelled unpaid.
ALTER TABLE "store_credit_entry" DROP CONSTRAINT "store_credit_entry_kind_check";--> statement-breakpoint
ALTER TABLE "store_credit_entry" ADD CONSTRAINT "store_credit_entry_kind_check" CHECK ("store_credit_entry"."kind" in ('adjustment', 'payment', 'refund', 'release'));--> statement-breakpoint
-- Store credit is split tender, like a gift card: it sits beside the one gateway capture.
DROP INDEX IF EXISTS "payment_one_capture_per_order";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_one_capture_per_order" ON "payment" USING btree ("store_id","order_id") WHERE "payment"."status" = 'captured' and "payment"."provider" not in ('gift_card', 'store_credit') and not "payment"."multi_capture" and not "payment"."refund_needed";
