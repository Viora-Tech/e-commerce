# Archive cancelled orders automatically (#1294)

Shoppers who never pay a manual UPI order, and card retries that each become an order cancelled
after 30 minutes, were filling the Orders list. Cancelled orders are now archived as they are
cancelled.

- **Setting**: `archiveCancelled` in `store.preferences.checkout` (`CheckoutSettingsSchema`,
  default `true`, so existing stores get it without a write). Admin: Settings → Checkout, a
  switch row "Archive orders automatically when they're cancelled" (copy in
  `apps/admin/src/data/checkout-settings.ts` rows, Hindi in `data/hi/checkout-settings.ts`).
- **Where**: `cancelOrder` in `packages/core/src/order/status.ts`. Every cancel goes through it
  (staff cancel, `changeOrderStatus`, unpaid online expiry, manual UPI auto-cancel, the COD
  confirm link, automations, pre-order balance cancel, test orders), so the archive is set in
  the same `UPDATE` that flips the status, inside the caller's transaction.
  `coalesce(archived_at, now())` keeps an earlier archive time. A repeated cancel is still a
  no-op, so an order the merchant unarchived stays unarchived.
- **Lists**: the Cancelled tab now includes archived orders (`order-views.ts`); every other
  working tab still leaves archived orders out. Search without a tab, the Archived tab and the
  customer page already showed archived orders. Unarchive is unchanged (`setOrdersArchived`).
- **Backfill**: migration `0228_archive_cancelled_orders.sql` archives cancelled orders that are
  not archived yet, in stores where the setting is not `false` (all of them today). Archive time
  is the migration time, since orders have no cancelled-at column.
- **Tests**: `packages/core/src/order/archive-on-cancel.test.ts` (default on, staff cancel,
  setting off, earlier archive kept, unarchive then repeat cancel, the migration SQL),
  `packages/api/test/orders-status-split.test.ts` (archived cancelled order under Cancelled,
  Archived and search, not All). `checkout/settings.test.ts` default list updated (it was also
  missing `recommendedMethod`, failing on dev).
