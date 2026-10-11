ALTER TABLE "payment" ADD COLUMN "fee_tax_paise" integer;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "method_detail" jsonb;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fee_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "payment_fee_unknown" ON "payment" USING btree ("created_at") WHERE "payment"."fee_paise" is null and "payment"."provider_payment_id" is not null and "payment"."status" in ('captured', 'refunded');--> statement-breakpoint
-- Store ids with a captured Razorpay or Cashfree payment from the last 90 days whose fee is not
-- known yet and was not asked about in the last 6 hours. For the worker's fee sync. Ids only,
-- same pattern as stores_with_certificate_checks (0113).
CREATE OR REPLACE FUNCTION stores_with_unknown_payment_fees() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM payment
  WHERE fee_paise IS NULL
    AND provider_payment_id IS NOT NULL
    AND status IN ('captured', 'refunded')
    AND provider IN ('razorpay', 'razorpay_upi', 'cashfree')
    AND created_at > now() - interval '90 days'
    AND (fee_checked_at IS NULL OR fee_checked_at < now() - interval '6 hours');
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_unknown_payment_fees() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_unknown_payment_fees() TO app;
