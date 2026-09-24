-- Order status split: `status` becomes lifecycle only (draft | open | completed |
-- cancelled); money and goods move to `payment_status` and `fulfillment_status`,
-- derived from payments, refunds, line quantities and shipments (same rules as
-- `@commerce/core/order-status`, which `recomputeOrderStatuses` applies from now on).
-- Pattern from Medusa aggregate-status (MIT) and Saleor charge_status (BSD-3).
-- Idempotent: every step can run again and lands on the same values.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_status_check";--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_payment_status_check";--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_fulfillment_status_check";--> statement-breakpoint
DROP INDEX IF EXISTS "order_placed_at_unpaid";--> statement-breakpoint
-- An old "delivered" was the merchant's (or courier's) word that the parcel
-- arrived. Keep it as the hand-delivered marker; it only counts once every
-- line is packed. The time is the courier's delivery, else when it was placed
-- (the old status kept no date).
UPDATE "order" o SET "delivered_at" = COALESCE(
    (SELECT max(s."updated_at") FROM "shipment" s WHERE s."order_id" = o."id" AND s."status" = 'delivered'),
    o."placed_at")
  WHERE o."status" = 'delivered' AND o."delivered_at" IS NULL;--> statement-breakpoint
-- Lifecycle: placed, paid, fulfilled and delivered were all live orders.
UPDATE "order" SET "status" = 'open' WHERE "status" IN ('placed', 'paid', 'fulfilled', 'delivered');--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
-- Payment status and the checkout-paid time, from payment attempts and refunds.
WITH pay AS (
  SELECT p."order_id", p."status", p."amount_paise", p."refund_needed", p."created_at",
    COALESCE((SELECT sum(r."amount_paise") FROM "refund" r
      WHERE r."payment_id" = p."id" AND r."status" <> 'failed'), 0) AS refunded
  FROM "payment" p
),
agg AS (
  SELECT "order_id",
    COALESCE(sum("amount_paise") FILTER (WHERE "status" IN ('captured', 'refunded') AND NOT "refund_needed"), 0) AS captured,
    COALESCE(sum(LEAST(refunded, "amount_paise")) FILTER (WHERE "status" IN ('captured', 'refunded') AND NOT "refund_needed"), 0) AS refunded,
    COALESCE(bool_or("refund_needed" AND "status" IN ('captured', 'refunded') AND refunded < "amount_paise"), false) AS owed_back,
    COALESCE(bool_or("status" = 'authorized' AND NOT "refund_needed"), false) AS authorized,
    max("created_at") FILTER (WHERE "status" IN ('captured', 'refunded') AND NOT "refund_needed") AS last_capture_at
  FROM pay GROUP BY "order_id"
),
facts AS (
  SELECT o."id", o."total_paise",
    o."total_paise" - CASE WHEN o."balance_paid_at" IS NULL
      THEN GREATEST(COALESCE(o."balance_due_paise", 0), 0) ELSE 0 END AS due_now,
    COALESCE(a.captured, 0) AS captured, COALESCE(a.refunded, 0) AS refunded,
    COALESCE(a.owed_back, false) AS owed_back, COALESCE(a.authorized, false) AS authorized,
    a.last_capture_at
  FROM "order" o LEFT JOIN agg a ON a."order_id" = o."id"
  WHERE o."imported_from" IS NULL
)
UPDATE "order" o SET
  "payment_status" = CASE
    WHEN f.owed_back THEN 'refund_needed'
    WHEN f.captured > 0 AND f.refunded >= f.captured THEN 'refunded'
    WHEN f.refunded > 0 THEN 'partially_refunded'
    WHEN f.captured >= f."total_paise" AND (f.captured > 0 OR f."total_paise" <= 0) THEN 'paid'
    WHEN f.captured > 0 THEN 'partially_paid'
    WHEN f.authorized THEN 'authorized'
    ELSE 'unpaid' END,
  "checkout_paid_at" = CASE
    WHEN o."status" <> 'draft' AND f.captured >= f.due_now AND (f.captured > 0 OR f.due_now <= 0)
      THEN COALESCE(o."checkout_paid_at", f.last_capture_at, o."placed_at")
    ELSE o."checkout_paid_at" END
FROM facts f WHERE o."id" = f."id";--> statement-breakpoint
-- Fulfilment status, from packed quantities and shipments (RTO on every live
-- shipment reads as returned). Demo rows marked "fulfilled" with nothing
-- packed come out unfulfilled: the lines are the record.
WITH l AS (
  SELECT "order_id", sum("quantity") AS ordered,
    sum(LEAST(GREATEST("fulfilled_quantity", 0), "quantity")) AS packed
  FROM "order_line" GROUP BY "order_id"
),
s AS (
  SELECT "order_id",
    count(*) FILTER (WHERE "status" <> 'cancelled') AS live,
    count(*) FILTER (WHERE "status" NOT IN ('cancelled', 'rto')) AS moving,
    count(*) FILTER (WHERE "status" = 'delivered') AS delivered,
    count(*) FILTER (WHERE "status" IN ('picked_up', 'in_transit', 'out_for_delivery')) AS transit
  FROM "shipment" GROUP BY "order_id"
),
facts AS (
  SELECT o."id", o."delivered_at",
    COALESCE(l.ordered, 0) AS ordered, COALESCE(l.packed, 0) AS packed,
    COALESCE(s.live, 0) AS live, COALESCE(s.moving, 0) AS moving,
    COALESCE(s.delivered, 0) AS delivered, COALESCE(s.transit, 0) AS transit
  FROM "order" o
  LEFT JOIN l ON l."order_id" = o."id"
  LEFT JOIN s ON s."order_id" = o."id"
  WHERE o."imported_from" IS NULL
)
UPDATE "order" o SET "fulfillment_status" = CASE
    WHEN f.live > 0 AND f.moving = 0 THEN 'returned'
    WHEN f.ordered = 0 OR f.packed = 0 THEN 'unfulfilled'
    WHEN f.packed < f.ordered THEN
      CASE WHEN f.delivered > 0 THEN 'partially_delivered' ELSE 'partially_fulfilled' END
    WHEN f."delivered_at" IS NOT NULL THEN 'delivered'
    WHEN f.moving = 0 THEN 'fulfilled'
    WHEN f.delivered = f.moving THEN 'delivered'
    WHEN f.delivered > 0 THEN 'partially_delivered'
    WHEN f.transit > 0 THEN 'shipped'
    ELSE 'fulfilled' END
FROM facts f WHERE o."id" = f."id";--> statement-breakpoint
-- Imported orders are a record of what the source platform said.
UPDATE "order" SET
  "payment_status" = CASE lower(COALESCE("import_meta"->>'financialStatus', ''))
    WHEN 'paid' THEN 'paid'
    WHEN 'partially_paid' THEN 'partially_paid'
    WHEN 'partially_refunded' THEN 'partially_refunded'
    WHEN 'refunded' THEN 'refunded'
    WHEN 'authorized' THEN 'authorized'
    ELSE 'unpaid' END,
  "fulfillment_status" = CASE lower(COALESCE("import_meta"->>'fulfillmentStatus', ''))
    WHEN 'fulfilled' THEN 'fulfilled'
    WHEN 'partial' THEN 'partially_fulfilled'
    WHEN 'partially_fulfilled' THEN 'partially_fulfilled'
    WHEN 'restocked' THEN 'returned'
    ELSE 'unfulfilled' END
WHERE "imported_from" IS NOT NULL;--> statement-breakpoint
UPDATE "order" SET
  "status" = CASE
    WHEN NULLIF("import_meta"->>'cancelledAt', '') IS NOT NULL THEN 'cancelled'
    WHEN "fulfillment_status" = 'fulfilled' AND "payment_status" IN ('paid', 'partially_refunded', 'refunded') THEN 'completed'
    ELSE 'open' END,
  "checkout_paid_at" = CASE
    WHEN "payment_status" IN ('paid', 'partially_refunded', 'refunded') THEN COALESCE("checkout_paid_at", "placed_at")
    ELSE "checkout_paid_at" END
WHERE "imported_from" IS NOT NULL AND "status" <> 'draft';--> statement-breakpoint
-- Completed: paid, and delivered (or, for gift cards only, issued).
UPDATE "order" o SET "status" = CASE
    WHEN o."payment_status" IN ('paid', 'partially_refunded', 'refunded')
      AND (o."fulfillment_status" = 'delivered'
        OR (o."fulfillment_status" = 'fulfilled' AND NOT COALESCE(
          (SELECT bool_or(NOT ol."gift_card") FROM "order_line" ol WHERE ol."order_id" = o."id"), false)))
      THEN 'completed'
    ELSE 'open' END
WHERE o."status" IN ('open', 'completed') AND o."imported_from" IS NULL;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_status_check" CHECK ("order"."status" in ('draft', 'open', 'completed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_payment_status_check" CHECK ("order"."payment_status" in ('unpaid', 'authorized', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'refund_needed'));--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_fulfillment_status_check" CHECK ("order"."fulfillment_status" in ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'shipped', 'partially_delivered', 'delivered', 'returned'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_store_payment_status" ON "order" USING btree ("store_id","payment_status","placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_store_fulfillment_status" ON "order" USING btree ("store_id","fulfillment_status","placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_store_status" ON "order" USING btree ("store_id","status","placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_placed_at_unpaid" ON "order" USING btree ("store_id","placed_at") WHERE "order"."status" = 'open' and "order"."checkout_paid_at" is null;--> statement-breakpoint
-- Worker scans that read the old "placed" status now read "checkout not paid yet".
CREATE OR REPLACE FUNCTION stores_with_unpaid_online_orders() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'open'
    AND checkout_paid_at IS NULL
    AND imported_from IS NULL
    AND payment_method NOT IN ('cod', 'manual', 'gift_card');
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_pending_manual_orders() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'open'
    AND checkout_paid_at IS NULL
    AND imported_from IS NULL
    AND payment_method = 'manual';
$$;
