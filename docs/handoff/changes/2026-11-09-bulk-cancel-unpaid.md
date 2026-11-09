# Orders list: cancel several unpaid orders at once (#1408)

Before: the bulk bar's **Mark as > Cancelled** called `orders.setStatus` per order. That was a
different path from the order page's **Cancel order** (`orders.cancel` / `cancelOrderByStaff`):
paid orders were cancelled with the money left unrefunded, it was held by `orders.write` approval
ticks instead of `orders.cancel`, and the owner did not find it as "cancel".

- **More actions > Cancel orders** (last, destructive) opens a confirm in
  `components/orders/orders-bulk-dialogs.tsx` with **Restock the items** and **Email customers**
  (both on, as in the order page's dialog). It calls the order page's own `orders.cancel` with
  `refund: 'none'` and `onlyWithoutRefund: true` for each order, ten at a time. Same permission
  (`orders.cancel`), same approval and step-up policy: a role that needs approval gets one request
  per order, counted as "sent for approval".
- **Only orders with nothing to refund**: `cancelsWithoutRefund` in
  `packages/core/src/order/edit-rules.ts` (shared by the browser and the server): worked here (not
  an import), open and not shipped, payment status `unpaid` or `refunded`. `authorized` is left
  out (a held card payment is the order page's decision). The server re-checks inside the locked
  transaction and also refuses any order with a refundable amount (`refundOptions`), with
  `ORDER_NEEDS_REFUND_DECISION` (BAD_REQUEST).
- Paid orders are skipped, as **Mark as** skips locked ones: the dialog says up front how many
  of the loaded orders are skipped and why, and the toast reports cancelled / sent for approval /
  skipped (paid or no longer cancellable) / failed.
- **Mark as** no longer offers Cancelled. The row menu's cancel (`setStatus`) is untouched: the
  order-page vs table cancel mismatch is fixed separately.
- Tests: `packages/core/src/order/edit.test.ts`, "bulk cancel: only orders with nothing to
  refund": an unpaid COD order is cancelled and restocked with no refund; a paid order, an order
  with a capture its status has not caught up with, and an imported order are refused and left
  as they were; the rule's table of statuses.
- No migration.

## Test

On `/orders` select an unpaid COD order and a paid order, More actions > Cancel orders: the
dialog says 1 skipped; confirm: "1 order cancelled, 1 skipped …". The paid one is still open.
