-- Settings → Checkout → "Archive orders automatically when they're cancelled" is on by default
-- (`archiveCancelled` in `store.preferences.checkout`). New cancels are archived as they happen;
-- this archives the cancelled orders already in the list, once, for every store that has not
-- turned the setting off. The order has no "cancelled at" column, so the archive time is the
-- moment this runs. Each one can still be unarchived from the Orders list.
UPDATE "order" o
SET "archived_at" = now()
FROM "store" s
WHERE s."id" = o."store_id"
  AND o."status" = 'cancelled'
  AND o."archived_at" IS NULL
  AND coalesce(s."preferences"->'checkout'->>'archiveCancelled', 'true') <> 'false';
